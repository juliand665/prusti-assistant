import * as vscode from 'vscode';
import * as fs from 'fs-extra';
import * as os from 'os';
import * as path from 'path';
import * as util from './util';
import * as notifier from './notifier';
import { Dependency, Location, FileDownloader, InstallerSequence, LocalReference, ZipExtractor } from './dependencies';

export async function installDependencies(context: vscode.ExtensionContext, shouldUpdate: boolean): Promise<PrustiLocation> {
    notifier.notify(notifier.Event.StartPrustiUpdate);

    try {
        let lastProgress = 0;
        const location = await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: `${shouldUpdate ? "Updating" : "Installing"} Prusti`
        }, p => {
            const tools = prustiTools(currentPlatform!, context);
            return tools.install("stable", shouldUpdate, (fraction, step) => {
                console.log(`${fraction * 100}% completed (${step})`);
                p.report({ message: step, increment: (fraction - lastProgress) * 100 });
                lastProgress = fraction;
            });
        });
        const prusti = new PrustiLocation(location);

        // only notify user about success if we reported anything in between; otherwise there was nothing to be done.
        if (lastProgress > 0) {
            // TODO why restart only if updated?
            if (shouldUpdate) {
                util.userInfo("Prusti updated successfully. Please restart the IDE.", true, true);
            } else {
                util.userInfo("Prusti installed successfully.");
            }
        }

        return prusti;
    } catch (err) {
        util.userError(`Error installing Prusti: ${err}`);
        throw err;
    } finally {
        notifier.notify(notifier.Event.EndPrustiUpdate);
    }
}

export class PrustiLocation {
    constructor(
        private readonly location: Location
    ) {
        // Set execution flags (ignored on Windows)
        fs.chmodSync(this.prustiDriver(), 0o775);
        fs.chmodSync(this.prustiRustc(), 0o775);
        fs.chmodSync(this.cargoPrusti(), 0o775);
        fs.chmodSync(this.z3(), 0o775);
    }

    public prustiDriver(): string {
        return this.location.path(this.executable("prusti-driver"));
    }

    public prustiRustc(): string {
        return this.location.path(this.executable("prusti-rustc"));
    }

    public cargoPrusti(): string {
        return this.location.path(this.executable("cargo-prusti"));
    }

    public z3(): string {
        return this.location.path("z3", this.executable("z3"));
    }

    public boogie(): string {
        return this.location.path("boogie", this.executable("boogie"));
    }

    public viperHome(): string {
        return this.location.path("viper");
    }

    private executable(name: string): string {
        return os.platform() === "win32" ? `${name}.exe` : name;
    }
}

function identifier(platform: Platform): string {
    switch (platform) {
        case Platform.Mac:
            return "Mac";
        case Platform.Windows:
            return "Win";
        case Platform.Linux:
            return "Linux";
    }
}

function prustiTools(platform: Platform, context: vscode.ExtensionContext): Dependency {
    const id = identifier(platform);
    function zipInstaller(url: string): InstallerSequence {
        return new InstallerSequence([
            new FileDownloader(url),
            new ZipExtractor("prusti"),
        ]);
    }

    return new Dependency(
        path.join(context.globalStoragePath, "prusti"),
        ["stable", zipInstaller(`http://viper.ethz.ch/downloads/PrustiTools${id}.zip`)],
        ["nightly", zipInstaller(`http://viper.ethz.ch/downloads/nightly/PrustiTools${id}.zip`)],
        ["local", new LocalReference("~/Local/")],
    );
}

enum Platform {
    Linux,
    Windows,
    Mac,
}

export const currentPlatform: Platform | null = (() => {
    const platform = os.platform();
    switch (platform) {
        case "linux":
            return Platform.Linux;
        case "win32":
            return Platform.Windows;
        case "darwin":
            return Platform.Mac;
        default:
            console.log(`Unsupported platform: ${platform}`);
            return null;
    }
})();