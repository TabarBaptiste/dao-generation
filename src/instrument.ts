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

// 🧩 Initialisation de Sentry
Sentry.init({
    dsn: "https://fec769f488edb06ab03507cfa62396ed@o4510193562091520.ingest.de.sentry.io/4510193596170320",
    environment: process.env.NODE_ENV || "development",
    release: getReleaseFromPackage(),
    sendDefaultPii: false,
    tracesSampleRate: 1.0,

    // 🎯 Filtrer les erreurs qui ne viennent pas de ton code
    beforeSend(event, hint) {
        const frames = event.exception?.values?.[0]?.stacktrace?.frames || [];
        const isExternal = frames.some((frame) =>
            [
                "vscode",
                "copilot",
                "node_modules",
                "extensions",
                "typescript",
            ].some((kw) => frame.filename?.includes(kw))
        );

        // Ignore les erreurs externes ou "Canceled"
        if (isExternal || event.exception?.values?.[0]?.type?.includes("Canceled")) {
            return null;
        }

        return event;
    },
});

// 🧠 Associer le nom d'utilisateur à l'événement
try {
    const username = os.userInfo().username;
    if (username) {
        Sentry.setUser({ username });
    }
} catch {
    // Si os.userInfo() échoue (rare), on ignore
}

// ✅ Export de Sentry pour le reste de ton projet
export { Sentry };
