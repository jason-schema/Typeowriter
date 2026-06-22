import React, { useState, useEffect, useRef } from 'react';

const Typewriter = () => {
    const [lines, setLines] = useState([""]);
    const [activeLineIndex, setActiveLineIndex] = useState(0);
    const [cursorCol, setCursorCol] = useState(0);

    const [fileName, setFileName] = useState("untitled-000");
    const [isEditingName, setIsEditingName] = useState(false);
    const [isAllSelected, setIsAllSelected] = useState(false);
    const [fontSize, setFontSize] = useState(12);

    const [charWidth, setCharWidth] = useState(0);
    const measureRef = useRef(null);
    const nameInputRef = useRef(null);

    // Focus State
    const [isWindowFocused, setIsWindowFocused] = useState(true);

    // Measure character width for the monospaced font
    useEffect(() => {
        if (measureRef.current) {
            const rect = measureRef.current.getBoundingClientRect();
            setCharWidth(rect.width);
        }
    }, [fontSize]); // Re-measure when font size changes

    // Focus name input when editing starts
    useEffect(() => {
        if (isEditingName && nameInputRef.current) {
            nameInputRef.current.focus();
        }
    }, [isEditingName]);

    // Track Window Focus
    useEffect(() => {
        const onFocus = () => setIsWindowFocused(true);
        const onBlur = () => setIsWindowFocused(false);
        window.addEventListener('focus', onFocus);
        window.addEventListener('blur', onBlur);
        return () => {
            window.removeEventListener('focus', onFocus);
            window.removeEventListener('blur', onBlur);
        };
    }, []);

    const downloadFile = () => {
        const textContent = lines.join('\n');
        const blob = new Blob([textContent], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${fileName}.txt`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    const handleLineClick = (e, lineIndex) => {
        if (!charWidth) return;

        // Calculate click position relative to the line start
        // The line is centered, but we can get the click X relative to the viewport
        // and the line's rendered position.
        // Actually, simpler: get the click X relative to the target element (the line div)
        const rect = e.currentTarget.getBoundingClientRect();
        const clickX = e.clientX - rect.left;

        // Calculate character index
        let col = Math.round(clickX / charWidth);

        // Clamp to line length
        const lineLength = lines[lineIndex].length;
        if (col < 0) col = 0;
        if (col > lineLength) col = lineLength;

        setActiveLineIndex(lineIndex);
        setCursorCol(col);
        setIsAllSelected(false); // Clear selection on click
    };

    useEffect(() => {
        const handleKeyDown = (e) => {
            // Filename Editing Logic
            if (isEditingName) {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    // If text is selected (which we do on click), move to end?
                    // Actually, the user asked: "If the filename is selected and the user clicks enter move the cursor to the end of the filename"
                    // We can check selection via window.getSelection or input ref
                    const input = nameInputRef.current;
                    if (input && input.selectionStart === 0 && input.selectionEnd === input.value.length) {
                        // All selected, move to end
                        input.selectionStart = input.selectionEnd = input.value.length;
                    } else {
                        // Save and exit
                        setIsEditingName(false);
                    }
                }
                return;
            }

            // Cmd+S to Save
            if ((e.metaKey || e.ctrlKey) && e.key === 's') {
                e.preventDefault();
                downloadFile();
                return;
            }

            // Cmd+A to Select All
            if ((e.metaKey || e.ctrlKey) && e.key === 'a') {
                e.preventDefault();
                setIsAllSelected(true);
                return;
            }

            // Font Size Control
            if ((e.metaKey || e.ctrlKey) && (e.key === '=' || e.key === '+')) {
                e.preventDefault();
                setFontSize(prev => Math.min(prev + 1, 18));
                return;
            }
            if ((e.metaKey || e.ctrlKey) && e.key === '-') {
                e.preventDefault();
                setFontSize(prev => Math.max(prev - 1, 12));
                return;
            }

            // Navigation
            if (e.key === 'ArrowLeft') {
                if (cursorCol > 0) {
                    setCursorCol(prev => prev - 1);
                } else if (activeLineIndex > 0) {
                    setActiveLineIndex(prev => prev - 1);
                    setCursorCol(lines[activeLineIndex - 1].length);
                }
                setIsAllSelected(false);
                return;
            }
            if (e.key === 'ArrowRight') {
                if (cursorCol < lines[activeLineIndex].length) {
                    setCursorCol(prev => prev + 1);
                } else if (activeLineIndex < lines.length - 1) {
                    setActiveLineIndex(prev => prev + 1);
                    setCursorCol(0);
                }
                setIsAllSelected(false);
                return;
            }
            if (e.key === 'ArrowUp') {
                if (activeLineIndex > 0) {
                    setActiveLineIndex(prev => prev - 1);
                    // Clamp cursor to new line length
                    setCursorCol(Math.min(cursorCol, lines[activeLineIndex - 1].length));
                }
                setIsAllSelected(false);
                return;
            }
            if (e.key === 'ArrowDown') {
                if (activeLineIndex < lines.length - 1) {
                    setActiveLineIndex(prev => prev + 1);
                    // Clamp cursor to new line length
                    setCursorCol(Math.min(cursorCol, lines[activeLineIndex + 1].length));
                }
                setIsAllSelected(false);
                return;
            }

            // Prevent default for other special keys if needed, but usually we want browser behavior
            // except for the ones we handle.

            if (e.key.length === 1 && !e.metaKey && !e.ctrlKey && !e.altKey) {
                // Regular character
                if (isAllSelected) {
                    // Replace all text
                    setLines([e.key]);
                    setActiveLineIndex(0);
                    setCursorCol(1);
                    setIsAllSelected(false);
                } else {
                    const currentLine = lines[activeLineIndex];
                    // Check for 65-char limit
                    if (currentLine.length >= 65) {
                        // Auto-return: Insert new line then the character
                        setLines(prev => {
                            const newLines = [...prev];
                            // If cursor is at end, just append new line
                            if (cursorCol >= currentLine.length) {
                                newLines.splice(activeLineIndex + 1, 0, e.key);
                            } else {
                                // If cursor is in middle, split line?
                                // "Shift carriage to new line" usually implies just moving down.
                                // Let's keep it simple: Split at cursor, insert char in new line?
                                // Or just force wrap?
                                // Let's do: Insert char, then check length? No, prevent > 65.
                                // Implementation: Split current line at cursor.
                                // Actually, we are just typing, we should probably just wrap the NEW character to the next line.
                                newLines.splice(activeLineIndex + 1, 0, e.key);
                            }
                            return newLines;
                        });
                        setActiveLineIndex(prev => prev + 1);
                        setCursorCol(1);
                    } else {
                        setLines(prev => {
                            const newLines = [...prev];
                            const line = newLines[activeLineIndex];
                            newLines[activeLineIndex] = line.slice(0, cursorCol) + e.key + line.slice(cursorCol);
                            return newLines;
                        });
                        setCursorCol(prev => prev + 1);
                    }
                }
            } else if (e.key === 'Enter') {
                if (isAllSelected) {
                    setLines(["", ""]);
                    setActiveLineIndex(1);
                    setCursorCol(0);
                    setIsAllSelected(false);
                } else {
                    setLines(prev => {
                        const newLines = [...prev];
                        const currentLine = newLines[activeLineIndex];
                        const firstPart = currentLine.slice(0, cursorCol);
                        const secondPart = currentLine.slice(cursorCol);

                        newLines[activeLineIndex] = firstPart;
                        newLines.splice(activeLineIndex + 1, 0, secondPart);
                        return newLines;
                    });
                    setActiveLineIndex(prev => prev + 1);
                    setCursorCol(0);
                }
            } else if (e.key === 'Backspace') {
                if (isAllSelected) {
                    setLines([""]);
                    setActiveLineIndex(0);
                    setCursorCol(0);
                    setIsAllSelected(false);
                } else {
                    if (cursorCol > 0) {
                        // Simple delete char
                        setLines(prev => {
                            const newLines = [...prev];
                            const currentLine = newLines[activeLineIndex];
                            newLines[activeLineIndex] = currentLine.slice(0, cursorCol - 1) + currentLine.slice(cursorCol);
                            return newLines;
                        });
                        setCursorCol(prev => prev - 1);
                    } else if (activeLineIndex > 0) {
                        // Merge with previous line
                        // We need to know the previous line length BEFORE updating lines to set cursor correctly
                        // But we can access it from 'lines' state since we are in the render scope closure
                        // and we haven't updated 'lines' yet.
                        const prevLineLength = lines[activeLineIndex - 1].length;

                        setLines(prev => {
                            const newLines = [...prev];
                            const currentLine = newLines[activeLineIndex];
                            const prevLine = newLines[activeLineIndex - 1];

                            newLines[activeLineIndex - 1] = prevLine + currentLine;
                            newLines.splice(activeLineIndex, 1);
                            return newLines;
                        });

                        setActiveLineIndex(prev => prev - 1);
                        setCursorCol(prevLineLength);
                    }
                }
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [activeLineIndex, cursorCol, isEditingName, isAllSelected, lines, fileName, fontSize]);

    // Dynamic Layout Calculations
    const lineHeight = fontSize * 2; // e.g., 24px for 12px font
    const translateX = -(cursorCol * charWidth);
    const verticalOffset = (activeLineIndex * lineHeight) + (lineHeight / 2); // Center active line

    // Cursor Focus State: Window must be focused AND not editing filename
    const isCursorFocused = isWindowFocused && !isEditingName;

    return (
        <div className="app-container">
            {/* Filename Display/Edit */}
            <div className="filename-container">
                {isEditingName ? (
                    <input
                        ref={nameInputRef}
                        type="text"
                        className="filename-input"
                        value={fileName}
                        onChange={(e) => setFileName(e.target.value)}
                        onBlur={() => setIsEditingName(false)}
                        onFocus={(e) => e.target.select()} // Select all on focus (click)
                    />
                ) : (
                    <span
                        className="filename-display"
                        onClick={() => setIsEditingName(true)}
                        title="Click to rename"
                    >
                        {fileName}
                    </span>
                )}
            </div>

            {/* Shortcuts List */}
            <div className="shortcuts-container">
                <div>Cmd + S : Save</div>
                <div>Cmd + A : Select All</div>
                <div>Cmd + + : Increase Font</div>
                <div>Cmd + - : Decrease Font</div>
            </div>

            {/* The Typewriter Area (Masked) */}
            <div
                className="typewriter-container"
                style={{ '--char-width': `${charWidth}px`, '--font-size': `${fontSize}px`, '--line-height': `${lineHeight}px` }}
            >
                {/* Hidden measurement element */}
                <span
                    ref={measureRef}
                    style={{ visibility: 'hidden', position: 'absolute', whiteSpace: 'pre', fontSize: `${fontSize}px` }}
                >
                    W
                </span>

                {/* Line Numbers Left */}
                <div
                    className="line-numbers-container left"
                    style={{
                        transform: `translateY(calc(50vh - ${verticalOffset}px))`,
                        transition: 'transform 0.1s ease-out'
                    }}
                >
                    {lines.map((_, index) => (
                        <div key={index} className="line-number-item" style={{ height: `${lineHeight}px`, lineHeight: `${lineHeight}px`, fontSize: `${fontSize}px` }}>
                            {index + 1}
                        </div>
                    ))}
                </div>

                {/* Line Numbers Right */}
                <div
                    className="line-numbers-container right"
                    style={{
                        transform: `translateY(calc(50vh - ${verticalOffset}px))`,
                        transition: 'transform 0.1s ease-out'
                    }}
                >
                    {lines.map((_, index) => (
                        <div key={index} className="line-number-item" style={{ height: `${lineHeight}px`, lineHeight: `${lineHeight}px`, fontSize: `${fontSize}px` }}>
                            {index + 1}
                        </div>
                    ))}
                </div>

                {/* The Paper (moves) */}
                <div
                    className="paper"
                    style={{
                        transform: `translate(calc(50vw + ${translateX}px), calc(50vh - ${verticalOffset}px))`,
                        transition: 'transform 0.1s ease-out' // Smooth movement
                    }}
                >
                    {lines.map((line, index) => (
                        <div
                            key={index}
                            className={`line ${index === activeLineIndex ? 'active' : ''} ${isAllSelected ? 'selected' : ''}`}
                            style={{ height: `${lineHeight}px`, lineHeight: `${lineHeight}px`, whiteSpace: 'pre', cursor: 'text', fontSize: `${fontSize}px` }}
                            onClick={(e) => handleLineClick(e, index)}
                        >
                            {line}
                        </div>
                    ))}
                </div>

                {/* The Static Cursor (Fixed in center) */}
                {!isAllSelected && <div className={`cursor-guide ${!isCursorFocused ? 'blurred' : ''}`}></div>}
            </div>
        </div>
    );
};

export default Typewriter;
