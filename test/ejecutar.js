// Compila y ejecuta código generado en una carpeta temporal. Los lenguajes sin compilador instalado quedan en null.
import { spawnSync, execFile } from "node:child_process";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const hay = (comando) => spawnSync("sh", ["-c", `command -v ${comando}`]).status === 0;

// [archivo, pasos previos (compilar), paso final (ejecutar)]
const RECETAS = {
  java: hay("javac") && ["Main.java", [["javac", "-Xlint:all", "-Werror", "Main.java"]], ["java", "-cp", ".", "Main"]],
  kotlin: hay("kotlinc") && ["main.kt", [["kotlinc", "main.kt", "-include-runtime", "-d", "main.jar"]], ["java", "-jar", "main.jar"]],
  csharp: hay("dotnet") && hay("csc") && ["Program.cs", [["csc", "-nologo", "Program.cs"]], ["dotnet", "Program.exe"]],
  cpp: hay("g++") && ["main.cpp", [["g++", "-std=c++20", "-Wall", "-Wextra", "-Werror", "-o", "programa", "main.cpp"]], ["./programa"]],
  c: hay("gcc") && ["main.c", [["gcc", "-std=c11", "-Wall", "-Wextra", "-Werror", "-o", "programa", "main.c"]], ["./programa"]],
  python: hay("python3") && ["main.py", [], ["python3", "main.py"]],
  javascript: ["main.js", [], [process.execPath, "main.js"]],
  php: hay("php") && ["main.php", [], ["php", "main.php"]],
};

export const disponible = (lenguaje) => Boolean(RECETAS[lenguaje]);

const correr = (comando, args, cwd) => new Promise((resolver) => {
  execFile(comando, args, { cwd, encoding: "utf8", timeout: 60_000 }, (error, stdout, stderr) =>
    resolver({ status: error ? (error.code ?? 1) : 0, stdout, stderr }));
});

export async function ejecutar(lenguaje, codigo) {
  const [archivo, compilar, final] = RECETAS[lenguaje];
  const dir = await mkdtemp(join(tmpdir(), "bb-"));
  try {
    await writeFile(join(dir, archivo), codigo);
    for (const [comando, ...args] of compilar) {
      const r = await correr(comando, args, dir);
      if (r.status !== 0) return r;
    }
    return await correr(final[0], final.slice(1), dir);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}
