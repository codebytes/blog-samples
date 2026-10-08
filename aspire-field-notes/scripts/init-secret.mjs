import { randomBytes } from "node:crypto";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const project = fileURLToPath(new URL("../catalog/Catalog.AppHost/Catalog.AppHost.csproj", import.meta.url));
const args = ["user-secrets", "list", "--project", project, "--json"];
const listed = spawnSync("dotnet", args, { encoding: "utf8", timeout: 30_000 });
if (listed.error || listed.status !== 0) {
  throw new Error("Cannot read AppHost user secrets. Check the .NET 10 SDK and project path.");
}
const start = listed.stdout.indexOf("{");
const end = listed.stdout.lastIndexOf("}");
if (start < 0 || end < start) throw new Error("Unexpected dotnet user-secrets JSON output.");
const secrets = JSON.parse(listed.stdout.slice(start, end + 1));
const key = "Parameters:postgres-password";
if (typeof secrets[key] === "string" && secrets[key].length > 0) {
  console.log("Keeping the existing Postgres secret. Its value is not displayed.");
} else {
  const saved = spawnSync("dotnet", ["user-secrets", "set", "--project", project], {
    input: JSON.stringify({ [key]: randomBytes(32).toString("base64url") }),
    encoding: "utf8",
    timeout: 30_000,
  });
  if (saved.error || saved.status !== 0) throw new Error("Could not save the Postgres user secret.");
  console.log("Saved a new Postgres secret outside the repository. Reuse it with this database volume.");
}
