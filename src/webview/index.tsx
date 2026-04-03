import * as React from 'react';
import * as ReactDOM from 'react-dom/client';
const ReactMarkdown = React.lazy(() => import('react-markdown'));

declare function acquireVsCodeApi(): any;
const vscode = acquireVsCodeApi();

type ChatMessage = { type: 'step' | 'feedback', text: string };

const App = () => {
    // Form State
    const [language, setLanguage] = React.useState('');
    const [level, setLevel] = React.useState('beginner');
    const [project, setProject] = React.useState('');
    const [focus, setFocus] = React.useState('');
    
    // UI State
    const [isSubmitted, setIsSubmitted] = React.useState(false);
    const [chatLog, setChatLog] = React.useState<ChatMessage[]>([]);
    const [isChecking, setIsChecking] = React.useState(false);
    const [isLoadingNext, setIsLoadingNext] = React.useState(false);

    React.useEffect(() => {
        // --- NEW: Tell the backend we are ready to receive saved data ---
        vscode.postMessage({ command: 'webviewReady' });

        const handleMessage = (event: MessageEvent) => {
            const message = event.data;
            
            // --- NEW: Load saved data ---
            if (message.command === 'resumeSession') {
                const { projectData, chatLog } = message.data;
                setLanguage(projectData.language);
                setLevel(projectData.level);
                setProject(projectData.project);
                setFocus(projectData.focus || '');
                setChatLog(chatLog);
                setIsSubmitted(true); // Bypass the form screen!
            } else if (message.command === 'stepGenerated') {
                setChatLog(prev => [...prev, { type: 'step', text: message.text }]);
                setIsLoadingNext(false);
            } else if (message.command === 'codeChecked') {
                setChatLog(prev => [...prev, { type: 'feedback', text: message.text }]);
                setIsChecking(false);
            } else if (message.command === 'error') {
                setChatLog(prev => [...prev, { type: 'feedback', text: `Oops! Error: ${message.text}` }]);
                setIsChecking(false);
                setIsLoadingNext(false);
            }
        };

        window.addEventListener('message', handleMessage);
        return () => window.removeEventListener('message', handleMessage);
    }, []);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!language || !project) return;

        vscode.postMessage({
            command: 'startProjectSetup',
            data: { language, level, project, focus }
        });

        setIsSubmitted(true);
        setChatLog([]); 
    };

    // --- UPDATED: Clear Session Button added to the bottom ---
    const handleClearSession = () => {
        if (confirm("Are you sure you want to clear your progress and start over?")) {
            vscode.postMessage({ command: 'clearSession' });
            setIsSubmitted(false);
            setChatLog([]);
            setProject('');
        }
    };

    if (isSubmitted) {
        return (
            <div style={styles.container}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--vscode-widget-border)', paddingBottom: '10px', marginBottom: '20px' }}>
                    <h2 style={{ margin: 0 }}>Your Learning Path 🗺️</h2>
                    
                    {/* --- NEW: Clear Session Button --- */}
                    <button onClick={handleClearSession} style={{ background: 'transparent', border: 'none', color: 'var(--vscode-errorForeground)', cursor: 'pointer', textDecoration: 'underline' }}>
                        Start Over
                    </button>
                </div>

                {chatLog.length === 0 ? (
                    <div>
                        <p>Generating Step 1...</p>
                        <p style={{ color: 'var(--vscode-descriptionForeground)', fontStyle: 'italic' }}>Setting up your personalized curriculum.</p>
                    </div>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', marginBottom: '30px' }}>
                        {chatLog.map((log, index) => (
                            <div key={index} style={{
                                padding: '15px',
                                borderRadius: '6px',
                                border: log.type === 'step' ? '1px solid var(--vscode-widget-border)' : 'none',
                                background: log.type === 'step' ? 'var(--vscode-editor-background)' : 'var(--vscode-editor-inactiveSelectionBackground)',
                                borderLeft: log.type === 'feedback' ? '4px solid var(--vscode-editorInfo-foreground)' : 'none'
                            }}>
                                <h4 style={{ marginTop: 0, marginBottom: '10px', color: log.type === 'step' ? 'var(--vscode-textLink-foreground)' : 'inherit' }}>
                                    {log.type === 'step' ? `Step ${Math.floor(index/2) + 1}` : 'AI Feedback'}
                                </h4>
                                <div className="markdown-body" style={styles.markdownWrapper}>
                                    <React.Suspense fallback={<span style={{ color: '#888' }}>Formatting...</span>}>
                                        <ReactMarkdown>{log.text}</ReactMarkdown>
                                    </React.Suspense>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
                
                {chatLog.length > 0 && (
                    <div style={{ position: 'sticky', bottom: '0', background: 'var(--vscode-editor-background)', padding: '20px 0', borderTop: '1px solid var(--vscode-widget-border)', display: 'flex', gap: '10px' }}>
                        <button onClick={() => { setIsChecking(true); vscode.postMessage({ command: 'checkCode' }); }} disabled={isChecking || isLoadingNext} style={{...styles.button, flex: 1, marginTop: 0, background: isChecking ? 'var(--vscode-button-secondaryBackground)' : 'var(--vscode-button-background)'}}>
                            {isChecking ? '👀 Reviewing...' : '🕵️ Check My Work'}
                        </button>
                        <button onClick={() => { setIsLoadingNext(true); vscode.postMessage({ command: 'nextStep' }); }} disabled={isChecking || isLoadingNext} style={{...styles.button, flex: 1, marginTop: 0, background: 'var(--vscode-button-secondaryBackground)'}}>
                            {isLoadingNext ? 'Generating...' : '⏭️ Next Step'}
                        </button>
                    </div>
                )}
            </div>
        );
    }

    return (
        <div style={styles.container}>
            <h2 style={{ marginBottom: '5px' }}>LearnKit</h2>
            <p style={{ color: 'var(--vscode-descriptionForeground, #ccc)', marginBottom: '20px' }}>What do you want to learn today?</p>
            <form onSubmit={handleSubmit} style={styles.form}>
                <div style={styles.inputGroup}>
                    <label style={styles.label}>Programming Language</label>
                    <input type="text" value={language} onChange={(e) => setLanguage(e.target.value)} placeholder="e.g., Python, JavaScript, Rust..." style={styles.input} required />
                </div>
                <div style={styles.inputGroup}>
                    <label style={styles.label}>Your Current Skill Level</label>
                    <select value={level} onChange={(e) => setLevel(e.target.value)} style={styles.input}>
                        <option value="beginner">Beginner</option>
                        <option value="intermediate">Intermediate</option>
                        <option value="advanced">Advanced</option>
                    </select>
                </div>
                <div style={styles.inputGroup}>
                    <label style={styles.label}>What do you want to build?</label>
                    <textarea value={project} onChange={(e) => setProject(e.target.value)} placeholder="e.g., A terminal-based Tic-Tac-Toe game..." style={{...styles.input, minHeight: '80px', resize: 'vertical'}} required />
                </div>
                <div style={styles.inputGroup}>
                    <label style={styles.label}>Specific Concepts to Focus On (Optional)</label>
                    <input type="text" value={focus} onChange={(e) => setFocus(e.target.value)} placeholder="e.g., Object Oriented Programming..." style={styles.input} />
                </div>
                <button type="submit" style={styles.button}>Generate Learning Path</button>
            </form>
        </div>
    );
};

const styles: { [key: string]: React.CSSProperties } = {
    container: { padding: '20px', fontFamily: 'var(--vscode-font-family, sans-serif)', color: 'var(--vscode-editor-foreground, #fff)', maxWidth: '700px', margin: '0 auto' },
    form: { display: 'flex', flexDirection: 'column', gap: '15px' },
    inputGroup: { display: 'flex', flexDirection: 'column', gap: '5px' },
    label: { fontWeight: 'bold', fontSize: '13px', color: 'var(--vscode-descriptionForeground, #ccc)' },
    input: { padding: '10px', fontSize: '14px', borderRadius: '4px', border: '1px solid var(--vscode-input-border, #444)', background: 'var(--vscode-input-background, #2d2d2d)', color: 'var(--vscode-input-foreground, #fff)', fontFamily: 'inherit' },
    button: { padding: '12px', fontSize: '14px', fontWeight: 'bold', background: 'var(--vscode-button-background, #007acc)', color: 'var(--vscode-button-foreground, #ffffff)', border: 'none', borderRadius: '4px', cursor: 'pointer', marginTop: '10px' },
    markdownWrapper: { fontSize: '14px', lineHeight: '1.6', color: 'var(--vscode-editor-foreground)' }
};

const rootElement = document.getElementById('root');
if (rootElement) {
    const root = ReactDOM.createRoot(rootElement);
    root.render(<App />);
}