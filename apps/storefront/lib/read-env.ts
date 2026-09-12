import fs from "fs";
import path from "path";

function findEnvRoots(): string[] {
  const starts = [
    process.cwd(),
    path.join(process.cwd(), ".."),
    path.join(process.cwd(), "../.."),
    path.join(__dirname, "../../.."),
    path.join(__dirname, "../../../.."),
  ];
  const roots: string[] = [];
  const seen = new Set<string>();
  for (const dir of starts) {
    const abs = path.resolve(dir);
    if (seen.has(abs)) continue;
    seen.add(abs);
    if (fs.existsSync(path.join(abs, ".env")) || fs.existsSync(path.join(abs, "yarn.lock"))) {
      roots.push(abs);
    }
  }
  return roots.length ? roots : [process.cwd()];
}

function stripQuotes(v: string) {
  const t = v.trim();
  if ((t.startsWith('"') && t.endsWith('"')) || (t.startsWith("'") && t.endsWith("'"))) {
    return t.slice(1, -1);
  }
  return t;
}

export function readEnv(key: string): string {
  const fromProc = (process.env[key] || "").trim();
  if (fromProc) return fromProc;

  for (const root of findEnvRoots()) {
    for (const name of [".env.local", ".env"]) {
      const file = path.join(root, name);
      if (!fs.existsSync(file)) continue;
      try {
        const text = fs.readFileSync(file, "utf8");
        for (const raw of text.split(/\r?\n/)) {
          const line = raw.trim();
          if (!line || line.startsWith("#")) continue;
          const i = line.indexOf("=");
          if (i < 1) continue;
          const k = line.slice(0, i).trim();
          if (k !== key) continue;
          return stripQuotes(line.slice(i + 1));
        }
      } catch {
        /* ignore */
      }
    }
  }
  return "";
}

export function readGoogleClientId(): string {
  return readEnv("NEXT_PUBLIC_GOOGLE_CLIENT_ID") || readEnv("GOOGLE_CLIENT_ID");
}
