/** Which app a Vite run builds/serves, from the KYROS_APP environment variable. */
export function resolveApp(value: string | undefined): "public" | "backoffice" {
  if (value === undefined || value === "" || value === "public") return "public";
  if (value === "backoffice") return "backoffice";
  throw new Error(`KYROS_APP must be "public" or "backoffice", got "${value}"`);
}
