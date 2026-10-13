# Legal documents

The footer (`src/components/AppFooter.tsx`) links to two PDFs served from this
folder. Drop the files here with these exact filenames:

| Link                 | Expected file                  |
| -------------------- | ------------------------------ |
| Terms & Conditions   | `terms-and-conditions.pdf`     |
| Website Terms of Use | `website-terms-of-use.pdf`     |

Files in `public/` are copied to the build root by Vite, so they are served at
`/legal/terms-and-conditions.pdf` and `/legal/website-terms-of-use.pdf`.

If you rename a file, update the matching `href` in `AppFooter.tsx`.
