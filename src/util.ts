import * as childProcess from 'child_process';
import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

export function userInfo(message: string, popup = true, restart = false) {
    log(message);
    vscode.window.setStatusBarMessage(message);
    if (popup) {
        if (restart) {
            const action = "Restart Now";
            vscode.window.showInformationMessage(message, action)
                .then(selection => {
                    if (selection === action) {
                        vscode.commands.executeCommand(
                            "workbench.action.reloadWindow"
                        );
                    }
                });
        } else {
            vscode.window.showInformationMessage(message);
        }
    }
}

export function userWarn(message: string, popup = true) {
    log(message);
    vscode.window.setStatusBarMessage(message);
    if (popup) {
        vscode.window.showWarningMessage(message);
    }
}

export function userError(message: string, popup = true, restart = false) {
    log(message);
    vscode.window.setStatusBarMessage(message);
    if (popup) {
        if (restart) {
            const action = "Restart Now";
            vscode.window.showInformationMessage(message, action)
                .then(selection => {
                    if (selection === action) {
                        vscode.commands.executeCommand(
                            "workbench.action.reloadWindow"
                        );
                    }
                });
        } else {
            vscode.window.showInformationMessage(message);
        }
    }
}

let _channel: vscode.OutputChannel;
export function log(message: string) {
    console.log(message);
    if (_channel === null) {
        _channel = vscode.window.createOutputChannel("Prusti Assistant");
    }
    _channel.appendLine(message);
}

export interface Output {
    stdout: string;
    stderr: string;
    code: number;
}

export function spawn(
    cmd: string,
    args?: string[] | undefined,
    options?: childProcess.SpawnOptionsWithoutStdio | undefined
): Promise<Output> {
    log(`Prusti Assistant: Running '${cmd} ${args ? args.join(' ') : ''}'`);
    return new Promise((resolve, reject) => {
        let stdout = '';
        let stderr = '';

        const proc = childProcess.spawn(cmd, args, options);

        proc.stdout.on('data', (data) => stdout += data);
        proc.stderr.on('data', (data) => stderr += data);
        proc.on('close', (code) => {
            log("┌──── Begin stdout ────┐");
            log(stdout);
            log("└──── End stdout ──────┘");
            log("┌──── Begin stderr ────┐");
            log(stderr);
            log("└──── End stderr ──────┘");
            resolve({ stdout, stderr, code });
        });
        proc.on('error', (err) => {
            log("┌──── Begin stdout ────┐");
            log(stdout);
            log("└──── End stdout ──────┘");
            log("┌──── Begin stderr ────┐");
            log(stderr);
            log("└──── End stderr ──────┘");
            console.log("Error", err);
            log(`Error: ${err}`);
            reject(err);
        });
    });
}

export class Project {
    private _path: string;

    public constructor(path: string) {
        this._path = path;
    }

    public get path() {
        return this._path;
    }

    public hasRootFile(fileName: string): Promise<boolean> {
        const filePath = path.join(this._path, fileName);
        return new Promise((resolve, reject) => {
            fs.access(filePath, fs.constants.F_OK, (err) => resolve(err ? false : true));
        });
    }
}

export class ProjectList {
    private _projects: Project[];

    public constructor(projects: Project[]) {
        this._projects = projects;
    }

    public get projects() {
        return this._projects;
    }

    public hasProjects() {
        return this._projects.length > 0;
    }

    public getParent(file: string) {
        for (const project of this._projects) {
            if (file.startsWith(project.path)) {
                return project;
            }
        }
        return undefined;
    }
}

/**
 * Find all projects in the workspace that contain a Cargo.toml file.
 *
 * @returns A project list.
 */
export async function findProjects(): Promise<ProjectList> {
    const projects: Project[] = [];
    (await vscode.workspace.findFiles('**/Cargo.toml')).forEach((path: vscode.Uri) => {
        projects.push(new Project(path.fsPath.replace(/[/\\]?Cargo\.toml$/, '')));
    });
    return new ProjectList(projects);
}
