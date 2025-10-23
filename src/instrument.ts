import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import * as Sentry from "@sentry/node";

// 🧩 Fonction pour déterminer dynamiquement la version à partir du package.json
function getReleaseFromPackage(): string {
    try {
        const pkgPath = path.resolve(__dirname, "..", "package.json");
        const raw = fs.readFileSync(pkgPath, "utf8");
        const pkg = JSON.parse(raw);
        if (pkg && pkg.version) {
            return pkg.version;
            // return `${pkg.name}@${pkg.version}`; 
        }
    } catch {
        // fallback silencieux
    }
    return "php-dao-generator@unknown";
}

// 🧩 Initialisation de Sentry avec capture manuelle uniquement
Sentry.init({
    dsn: "https://fec769f488edb06ab03507cfa62396ed@o4510193562091520.ingest.de.sentry.io/4510193596170320",
    environment: process.env.NODE_ENV || "development",
    release: getReleaseFromPackage(),
    sendDefaultPii: false,
    tracesSampleRate: 0,
    integrations: [],
    beforeSend(event) {
        // SEULES les erreurs avec le tag 'dao-generator-error' passent
        // Ce tag sera ajouté uniquement par nos fonctions ErrorHandler
        if (event.tags && event.tags['dao-generator-error'] === true && event.tags.operation) {
            return event;
        }
        
        // Rejeter TOUTES les autres erreurs (VS Code, Electron, extensions, etc.)
        console.debug('[Sentry] Erreur automatique rejetée:', event.exception?.values?.[0]?.value || 'unknown');
        return null;
    },
});

// 👤 Associer le nom d’utilisateur courant
try {
    const username = os.userInfo().username;
    if (username) {
        Sentry.setUser({ username });
    }
} catch {
    // Silencieux si os.userInfo échoue
}

// ✅ Export de Sentry pour ton ErrorHandler
export { Sentry };
