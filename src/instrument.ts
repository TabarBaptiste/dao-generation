import * as fs from 'fs';
import * as path from 'path';
import * as Sentry from "@sentry/node";

// Déterminer dynamiquement le champ `release` depuis package.json
function getReleaseFromPackage(): string {
    try {
        // essayer de lire le package.json depuis la racine du projet
        const pkgPath = path.resolve(__dirname, '..', '..', 'package.json');
        const raw = fs.readFileSync(pkgPath, 'utf8');
        const pkg = JSON.parse(raw);
        if (pkg && pkg.name && pkg.version) {
            return `${pkg.name}@${pkg.version}`;
        }
    } catch (err) {
        // fallback silencieux
    }
    // fallback hardcodé
    return 'php-dao-generator@unknown';
}

Sentry.init({
    dsn: "https://fec769f488edb06ab03507cfa62396ed@o4510193562091520.ingest.de.sentry.io/4510193596170320",
    environment: process.env.NODE_ENV || "development",
    release: getReleaseFromPackage(),
    sendDefaultPii: false,
    tracesSampleRate: 1.0,
});

export { Sentry };
