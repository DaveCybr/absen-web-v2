// src/lib/python.ts
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

/** Returns "python3" or "python" depending on what's available on this OS. */
export async function resolvePython(): Promise<string> {
  for (const bin of ["python3", "python"]) {
    try {
      const { stdout } = await execAsync(`${bin} --version`);
      if (stdout || true) return bin; // stdout or stderr — either way it ran
    } catch {
      // not found, try next
    }
  }
  throw new Error("Python is not installed or not in PATH");
}
