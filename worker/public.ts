// Entry for the public Worker (vaults.kyros.fi, wrangler.toml): read-only API.
import { createHandler } from "./handler";

export default createHandler({ stratWrites: false, requireAccess: false });
