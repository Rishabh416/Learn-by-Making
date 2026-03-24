import * as React from 'react';
import * as ReactDOM from 'react-dom/client';

declare function acquireVsCodeApi(): any;
const vscode = acquireVsCodeApi();

const App = () => {
    // Form State
    const [language, setLanguage] = React.useState('');
    const [level, setLevel] = React.useState('beginner');
    const [project, setProject] = React.useState('');
    const [focus, setFocus] = React.useState('');
    const [curriculum, setCurriculum] = React.useState<string | null>(null);
    
    // UI State
    const [isSubmitted, setIsSubmitted] = React.useState(false);

    // --- NEW: Listen for messages from the VSCode Backend ---
    React.useEffect(() => {
        const handleMessage = (event: MessageEvent) => {
            const message = event.data;
            
            if (message.command === 'learningPathGenerated') {
                // Save the Gemini response to state
                setCurriculum(message.text);
            } else if (message.command === 'error') {
                setCurriculum(`Oops! Something went wrong: ${message.text}`);
            }
        };

        window.addEventListener('message', handleMessage);
        return () => window.removeEventListener('message', handleMessage);
    }, []);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        
        if (!language || !project) return;

        // Send the structured data to the VSCode backend
        vscode.postMessage({
            command: 'startProjectSetup',
            data: { language, level, project, focus }
        });

        setIsSubmitted(true);
        setCurriculum(null); // Reset curriculum when submitting a new project
    };

    // --- UPDATED: Show Loading OR the Curriculum ---
    if (isSubmitted) {
        return (
            <div style={styles.container}>
                {curriculum ? (
                    <div>
                        <h2>Your Learning Path 🗺️</h2>
                        {/* Render the raw markdown text in a pre-formatted block */}
                        <pre style={styles.markdownBlock}>
                            {curriculum}
                        </pre>
                        
                        <button 
                            onClick={() => setIsSubmitted(false)} 
                            style={{...styles.button, background: 'var(--vscode-button-secondaryBackground, #555)'}}
                        >
                            ← Start a New Project
                        </button>
                    </div>
                ) : (
                    <div>
                        <h2>Setting up your workspace... ⚙️</h2>
                        <p>Analyzing your project idea and generating a custom learning path.</p>
                        <p style={{ color: 'var(--vscode-descriptionForeground, #888)', fontStyle: 'italic' }}>
                            Please wait while the AI prepares your curriculum.
                        </p>
                    </div>
                )}
            </div>
        );
    }

    return (
        <div style={styles.container}>
            <h2 style={{ marginBottom: '5px' }}>Project Learn AI 🚀</h2>
            <p style={{ color: 'var(--vscode-descriptionForeground, #ccc)', marginBottom: '20px' }}>What do you want to learn today?</p>
            
            <form onSubmit={handleSubmit} style={styles.form}>
                
                {/* 1. Language Choice */}
                <div style={styles.inputGroup}>
                    <label style={styles.label}>Programming Language</label>
                    <input 
                        type="text" 
                        value={language}
                        onChange={(e) => setLanguage(e.target.value)}
                        placeholder="e.g., Python, JavaScript, Rust..." 
                        style={styles.input}
                        required 
                    />
                </div>

                {/* 2. Skill Level */}
                <div style={styles.inputGroup}>
                    <label style={styles.label}>Your Current Skill Level</label>
                    <select 
                        value={level} 
                        onChange={(e) => setLevel(e.target.value)}
                        style={styles.input}
                    >
                        <option value="beginner">Beginner (I'm new to this language)</option>
                        <option value="intermediate">Intermediate (I know the basics)</option>
                        <option value="advanced">Advanced (I want to learn complex patterns)</option>
                    </select>
                </div>

                {/* 3. Project Idea */}
                <div style={styles.inputGroup}>
                    <label style={styles.label}>What do you want to build?</label>
                    <textarea 
                        value={project}
                        onChange={(e) => setProject(e.target.value)}
                        placeholder="e.g., A terminal-based Tic-Tac-Toe game, a Discord bot, a portfolio website..." 
                        style={{...styles.input, minHeight: '80px', resize: 'vertical'}}
                        required 
                    />
                </div>

                {/* 4. Optional Focus */}
                <div style={styles.inputGroup}>
                    <label style={styles.label}>Specific Concepts to Focus On (Optional)</label>
                    <input 
                        type="text" 
                        value={focus}
                        onChange={(e) => setFocus(e.target.value)}
                        placeholder="e.g., Object Oriented Programming, APIs, Loops..." 
                        style={styles.input}
                    />
                </div>

                <button type="submit" style={styles.button}>
                    Generate Learning Path
                </button>
            </form>
        </div>
    );
};

// --- Simple Inline Styles ---
const styles: { [key: string]: React.CSSProperties } = {
    container: {
        padding: '20px',
        fontFamily: 'var(--vscode-font-family, sans-serif)',
        color: 'var(--vscode-editor-foreground, #fff)',
        maxWidth: '600px',
        margin: '0 auto'
    },
    form: {
        display: 'flex',
        flexDirection: 'column',
        gap: '15px'
    },
    inputGroup: {
        display: 'flex',
        flexDirection: 'column',
        gap: '5px'
    },
    label: {
        fontWeight: 'bold',
        fontSize: '13px',
        color: 'var(--vscode-descriptionForeground, #ccc)'
    },
    input: {
        padding: '10px',
        fontSize: '14px',
        borderRadius: '4px',
        border: '1px solid var(--vscode-input-border, #444)',
        background: 'var(--vscode-input-background, #2d2d2d)',
        color: 'var(--vscode-input-foreground, #fff)',
        fontFamily: 'inherit'
    },
    button: {
        padding: '12px',
        fontSize: '14px',
        fontWeight: 'bold',
        background: 'var(--vscode-button-background, #007acc)',
        color: 'var(--vscode-button-foreground, #ffffff)',
        border: 'none',
        borderRadius: '4px',
        cursor: 'pointer',
        marginTop: '10px'
    },
    markdownBlock: {
        whiteSpace: 'pre-wrap', 
        fontFamily: 'var(--vscode-editor-font-family, monospace)', 
        background: 'var(--vscode-textCodeBlock-background, #1e1e1e)', 
        padding: '15px', 
        borderRadius: '5px',
        border: '1px solid var(--vscode-widget-border, #444)',
        overflowX: 'auto',
        fontSize: '14px',
        lineHeight: '1.5'
    }
};

const rootElement = document.getElementById('root');
if (rootElement) {
    const root = ReactDOM.createRoot(rootElement);
    root.render(<App />);
}