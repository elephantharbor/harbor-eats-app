import { execFile } from "node:child_process";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { describe, expect, it } from "vitest";
import { assessImageSlot } from "../factory/tools/structural_preflight.mjs";

const execFileAsync = promisify(execFile);
const tool = join(process.cwd(), "factory/tools/structural_preflight.mjs");

async function writeSlot(dir, names, freeze = "PASS") {
  await mkdir(dir, { recursive: true });
  for (const name of names) {
    await writeFile(join(dir, name), "pixel");
  }
  if (freeze) {
    await writeFile(join(dir, "FREEZE_INTEGRITY.json"), `${JSON.stringify({ FREEZE_INTEGRITY: freeze })}\n`);
  }
}

describe("structural preflight image slot", () => {
  it("passes a pending slot that has not started the image pass", async () => {
    const dir = await mkdtemp(join(tmpdir(), "preflight-pending-"));
    const result = await assessImageSlot(
      dir,
      { asset_generated: false, slot_status: "pending_image_pass" },
      "pending-meal"
    );
    expect(result.ok).toBe(true);
    expect(result.detail).toBe("pending_image_pass");
    await rm(dir, { recursive: true, force: true });
  });

  it("passes when assets are generated, the image files exist, and freeze integrity passes", async () => {
    const dir = await mkdtemp(join(tmpdir(), "preflight-done-"));
    await writeSlot(dir, ["meal.webp", "meal-640.webp", "img_v1.jpg"], "PASS");
    const result = await assessImageSlot(
      dir,
      {
        asset_generated: true,
        slot_status: "image_pass_complete",
        master_filename: "meal.webp",
        card_filename: "meal-640.webp",
        active_source_jpeg: "img_v1.jpg",
      },
      "meal"
    );
    expect(result.ok).toBe(true);
    expect(result.detail).toContain("freeze integrity PASS");
    await rm(dir, { recursive: true, force: true });
  });

  it("fails a half-done slot when a declared image file is missing", async () => {
    const dir = await mkdtemp(join(tmpdir(), "preflight-half-file-"));
    await writeSlot(dir, ["meal.webp", "img_v1.jpg"], "PASS");
    const result = await assessImageSlot(
      dir,
      {
        asset_generated: true,
        master_filename: "meal.webp",
        card_filename: "meal-640.webp",
        active_source_jpeg: "img_v1.jpg",
      },
      "meal"
    );
    expect(result.ok).toBe(false);
    expect(result.detail).toContain("half-done");
    expect(result.detail).toContain("meal-640.webp");
    await rm(dir, { recursive: true, force: true });
  });

  it("fails a half-done slot when the files exist but freeze integrity does not pass", async () => {
    const dir = await mkdtemp(join(tmpdir(), "preflight-half-freeze-"));
    await writeSlot(dir, ["meal.webp", "meal-640.webp"], "FAIL");
    const failed = await assessImageSlot(
      dir,
      { asset_generated: true, master_filename: "meal.webp", card_filename: "meal-640.webp" },
      "meal"
    );
    expect(failed.ok).toBe(false);
    expect(failed.detail).toContain("freeze integrity FAIL");

    await rm(join(dir, "FREEZE_INTEGRITY.json"));
    const missing = await assessImageSlot(
      dir,
      { asset_generated: true, master_filename: "meal.webp", card_filename: "meal-640.webp" },
      "meal"
    );
    expect(missing.ok).toBe(false);
    expect(missing.detail).toContain("freeze integrity missing");
    await rm(dir, { recursive: true, force: true });
  });

  it("still fails an image slot that is neither pending nor finished", async () => {
    const dir = await mkdtemp(join(tmpdir(), "preflight-unset-"));
    const result = await assessImageSlot(dir, { asset_generated: false }, "meal");
    expect(result.ok).toBe(false);
    await rm(dir, { recursive: true, force: true });
  });

  it("records image_slot PASS on a finished candidate and FAIL after the card is removed", async () => {
    const source = join(process.cwd(), "factory/waves/wave-13/candidates/linguine-with-clams");
    const root = await mkdtemp(join(tmpdir(), "preflight-cli-"));
    const dir = join(root, "linguine-with-clams");
    const { cp } = await import("node:fs/promises");
    await cp(source, dir, { recursive: true });

    const pass = await execFileAsync(process.execPath, [tool, dir]);
    expect(pass.stdout).toContain("STRUCTURAL_PREFLIGHT PASS");
    const passReport = JSON.parse(await readFile(join(dir, "STRUCTURAL_PREFLIGHT.json"), "utf8"));
    expect(passReport.checks.find((row) => row.id === "image_slot").result).toBe("PASS");

    await rm(join(dir, "linguine-with-clams-640.webp"));
    let failedStdout = "";
    try {
      await execFileAsync(process.execPath, [tool, dir]);
    } catch (error) {
      failedStdout = `${error.stdout || ""}\n${error.stderr || ""}`;
      expect(error.code).toBe(1);
    }
    expect(failedStdout).toContain("FAIL image_slot");
    expect(failedStdout).toContain("half-done");
    const failReport = JSON.parse(await readFile(join(dir, "STRUCTURAL_PREFLIGHT.json"), "utf8"));
    expect(failReport.checks.find((row) => row.id === "image_slot").result).toBe("FAIL");
    await rm(root, { recursive: true, force: true });
  });
});
