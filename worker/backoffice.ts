// Entry for the backoffice Worker (backoffice.kyros.fi behind Cloudflare Access,
// wrangler.backoffice.toml): also serves the strategy-data write API, and checks the
// Access token itself on every request.
import { createHandler } from "./handler";

export default createHandler({ stratWrites: true, requireAccess: true });
