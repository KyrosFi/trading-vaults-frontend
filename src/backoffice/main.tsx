// Operator backoffice entry (backoffice.kyros.fi, behind Cloudflare Access).
// Built with `KYROS_APP=backoffice vite build`; see vite.config.ts.
import { bootstrap } from "@/bootstrap";
import BackofficeApp from "./BackofficeApp";

bootstrap(BackofficeApp);
