import * as vscode from 'vscode';
import { GoogleGenerativeAI } from '@google/generative-ai';

export function activate(context: vscode.ExtensionContext) {
    console.log('Project Learn AI is active!');

    let disposable = vscode.commands.registerCommand('project-learn-ai.startLearning', () => {
        const config = vscode.workspace.getConfiguration('projectLearnAi');
        const apiKey = config.get<string>('geminiApiKey');

        if (!apiKey) {
            vscode.window.showErrorMessage('Please set your Gemini API Key in the extension settings to start learning.');
            return;
        }

        // Create the Webview Panel
        const panel = vscode.window.createWebviewPanel(
            'projectLearnAiPanel',
            'Learn AI Dashboard',
            vscode.ViewColumn.Two, // This opens it on the right side, Scrimba-style!
            {
                enableScripts: true, // Crucial for React to run
                localResourceRoots: [vscode.Uri.joinPath(context.extensionUri, 'dist')]
            }
        );

        // Get the path to our compiled React app
        const scriptUri = panel.webview.asWebviewUri(
            vscode.Uri.joinPath(context.extensionUri, 'dist', 'webview.js')
        );

        // Inject the HTML and the script
        panel.webview.html = `
            <!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Learn AI</title>
            </head>
            <body>
                <div id="root"></div>
                <script src="${scriptUri}"></script>
            </body>
            </html>
        `;
		panel.webview.onDidReceiveMessage(
            async message => {
                switch (message.command) {
                    case 'helloFromReact':
                        vscode.window.showInformationMessage(`React says: ${message.text}`);
                        panel.webview.postMessage({ command: 'replyFromVSCode', text: 'Backend connected! 🤝' });
                        return;
                    
                    case 'startProjectSetup':
                        const { language, level, project, focus } = message.data;
                        
                        try {
                            // 1. Initialize Gemini
                            const genAI = new GoogleGenerativeAI(apiKey);
                            // We use gemini-1.5-flash for fast, standard text responses
                            const model = genAI.getGenerativeModel({ model: "gemini-flash-lite-latest" });

                            // 2. Construct the Prompt Engineer
                            const prompt = `
                                You are an expert programming tutor inside VSCode. 
                                The user wants to build: "${project}".
                                Their language choice is: ${language}.
                                Their skill level is: ${level}.
                                Specific focus areas (if any): ${focus || 'None specified'}.

                                Please provide a structured, step-by-step curriculum to build this project. 
                                Keep it encouraging and format the output in clean Markdown.
                                Do not write the full code for them! Give them step 1 to start with, explaining the concepts they need to learn first.
                            `;

                            // 3. Call the API
                            const result = await model.generateContent(prompt);
                            const responseText = result.response.text();

                            // 4. Send the curriculum back to the React UI
                            panel.webview.postMessage({ 
                                command: 'learningPathGenerated', 
                                text: responseText 
                            });

                        } catch (error: any) {
                            vscode.window.showErrorMessage(`Gemini API Error: ${error.message}`);
                            panel.webview.postMessage({ command: 'error', text: 'Failed to generate curriculum.' });
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