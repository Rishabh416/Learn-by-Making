import * as vscode from 'vscode';
import { GoogleGenerativeAI, ChatSession } from '@google/generative-ai';
import * as fs from 'fs';
import * as path from 'path';

export function activate(context: vscode.ExtensionContext) {
    console.log('Project Learn AI is active!');

    let disposable = vscode.commands.registerCommand('project-learn-ai.startLearning', () => {
        const config = vscode.workspace.getConfiguration('projectLearnAi');
        const apiKey = config.get<string>('geminiApiKey');

        if (!apiKey) {
            vscode.window.showErrorMessage('Please set your Gemini API Key in the extension settings to start learning.');
            return;
        }

        const panel = vscode.window.createWebviewPanel(
            'projectLearnAiPanel',
            'Learn AI Dashboard',
            vscode.ViewColumn.Two,
            {
                enableScripts: true,
                localResourceRoots: [vscode.Uri.joinPath(context.extensionUri, 'dist')]
            }
        );

        const scriptUri = panel.webview.asWebviewUri(
            vscode.Uri.joinPath(context.extensionUri, 'dist', 'webview.js')
        );

        panel.webview.html = `
            <!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src ${panel.webview.cspSource} 'unsafe-inline'; style-src ${panel.webview.cspSource} 'unsafe-inline';">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Learn AI</title>
            </head>
            <body>
                <div id="root"></div>
                <script src="${scriptUri}"></script>
            </body>
            </html>
        `;

        // --- NEW: SESSION MANAGEMENT LOGIC ---
        let chatSession: ChatSession | null = null;
        let currentProjectData: any = null;
        let chatLog: { type: string, text: string }[] = [];

        // Identify the active workspace directory to save our hidden file
        const workspaceFolders = vscode.workspace.workspaceFolders;
        const workspacePath = workspaceFolders ? workspaceFolders[0].uri.fsPath : null;
        const stateFile = workspacePath ? path.join(workspacePath, '.learnstate.json') : null;

        // Helper: Save the current state to the hard drive
        async function saveSession() {
            if (!stateFile || !chatSession || !currentProjectData) return;
            try {
                const history = await chatSession.getHistory();
                const state = {
                    projectData: currentProjectData,
                    chatLog: chatLog,
                    history: history.map(h => ({ role: h.role, parts: h.parts })) // Extract clean history
                };
                fs.writeFileSync(stateFile, JSON.stringify(state, null, 2));
            } catch (e) {
                console.error("Failed to save state", e);
            }
        }

        // Helper: Load the state from the hard drive
        function loadSession() {
            if (!stateFile || !fs.existsSync(stateFile)) return false;
            try {
                const data = fs.readFileSync(stateFile, 'utf8');
                const state = JSON.parse(data);
                
                currentProjectData = state.projectData;
                chatLog = state.chatLog;
                
                const genAI = new GoogleGenerativeAI(apiKey!);
                const model = genAI.getGenerativeModel({ model: "gemini-flash-lite-latest" });
                
                // Re-initialize the chat with the saved memory!
                chatSession = model.startChat({ history: state.history });
                return true;
            } catch (e) {
                console.error("Failed to load state", e);
                return false;
            }
        }

        panel.webview.onDidReceiveMessage(
            async message => {
                switch (message.command) {
                    
                    // --- NEW: React tells us it's ready to receive data ---
                    case 'webviewReady':
                        if (loadSession()) {
                            // If we found a save file, send it to React to bypass the setup form
                            panel.webview.postMessage({
                                command: 'resumeSession',
                                data: { projectData: currentProjectData, chatLog: chatLog }
                            });
                        }
                        return;

                    // --- NEW: Clear the save file ---
                    case 'clearSession':
                        chatSession = null;
                        currentProjectData = null;
                        chatLog = [];
                        if (stateFile && fs.existsSync(stateFile)) {
                            fs.unlinkSync(stateFile);
                        }
                        return;

                    case 'startProjectSetup':
                        currentProjectData = message.data;
                        chatLog = []; // Reset log
                        
                        try {
                            const genAI = new GoogleGenerativeAI(apiKey);
                            const model = genAI.getGenerativeModel({ model: "gemini-flash-lite-latest" });

                            chatSession = model.startChat({
                                history: [
                                    { role: "user", parts: [{ text: `You are a tutor. User wants to build: "${currentProjectData.project}" using ${currentProjectData.language}. Skill: ${currentProjectData.level}. Focus: ${currentProjectData.focus || 'None'}. Provide ONLY Step 1.` }] },
                                    { role: "model", parts: [{ text: "Understood. I am ready to provide Step 1." }] }
                                ]
                            });

                            const result = await chatSession.sendMessage("Please provide Step 1.");
                            const responseText = result.response.text();
                            
                            chatLog.push({ type: 'step', text: responseText });
                            await saveSession(); // Save to disk

                            panel.webview.postMessage({ command: 'stepGenerated', text: responseText });

                        } catch (error: any) {
                            panel.webview.postMessage({ command: 'error', text: 'Failed to generate curriculum.' });
                        }
                        return;

                    case 'checkCode':
                        if (!chatSession) return;
                        
                        const editor = vscode.window.activeTextEditor;
                        if (!editor) {
                            panel.webview.postMessage({ command: 'codeChecked', text: '⚠️ **No active file found.** Click inside your code file.' });
                            return;
                        }

                        const studentCode = editor.document.getText();
                        const fileLang = editor.document.languageId;

                        if (studentCode.trim() === '') {
                            panel.webview.postMessage({ command: 'codeChecked', text: "Your file is empty! Give it a try first." });
                            return;
                        }

                        try {
                            const result = await chatSession.sendMessage(`Here is my ${fileLang} code:\n\`\`\`${fileLang}\n${studentCode}\n\`\`\`\nReview this against the current step. Give brief feedback and hints. Do not write the exact code.`);
                            const feedbackText = result.response.text();

                            chatLog.push({ type: 'feedback', text: feedbackText });
                            await saveSession(); // Save to disk

                            panel.webview.postMessage({ command: 'codeChecked', text: feedbackText });
                        } catch (error: any) {
                            panel.webview.postMessage({ command: 'error', text: 'Failed to check code.' });
                        }
                        return;

                    case 'nextStep':
                        if (!chatSession) return;
                        try {
                            const result = await chatSession.sendMessage("I'm ready for the next step. Please provide the next instruction.");
                            const stepText = result.response.text();

                            chatLog.push({ type: 'step', text: stepText });
                            await saveSession(); // Save to disk

                            panel.webview.postMessage({ command: 'stepGenerated', text: stepText });
                        } catch (error: any) {
                            panel.webview.postMessage({ command: 'error', text: 'Failed to fetch the next step.' });
                        }
                        return;
                }
            },
            undefined,
            context.subscriptions
        );
    });

    context.subscriptions.push(disposable);
}

export function deactivate() {}