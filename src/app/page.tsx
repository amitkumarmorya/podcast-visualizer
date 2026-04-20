"use client";

import { useState } from "react";

const API_BASE = process.env.NODE_ENV === "development" ? "http://localhost:8000" : "";

export default function Home() {
  const [scriptText, setScriptText] = useState("");
  const [brandColors, setBrandColors] = useState("#000000, #FFFFFF");
  const [isProcessing, setIsProcessing] = useState(false);
  const [results, setResults] = useState<any[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [finalImages, setFinalImages] = useState<string[]>([]);
  const [numOutputs, setNumOutputs] = useState(5);
  const [isExtractingColors, setIsExtractingColors] = useState(false);
  const [isRegeneratingIndex, setIsRegeneratingIndex] = useState<number | null>(null);
  const [designStyle, setDesignStyle] = useState("3D Minimalist");
  const [overlaySelections, setOverlaySelections] = useState<Record<number, string>>({});
  const [isSavingToDriveIndex, setIsSavingToDriveIndex] = useState<number | null>(null);
  
  const primaryBrandColor = brandColors.split(',')[0].trim() || '#111827';

  const handleCompositeAction = (index: number, url: string, action: 'download' | 'drive') => {
    if (action === 'drive') setIsSavingToDriveIndex(index);
    
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    
    // Create new image correctly using anonymous CORS
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.src = url;
    
    img.onload = () => {
      canvas.width = img.width;
      canvas.height = img.height;
      
      // Draw base image
      ctx.drawImage(img, 0, 0);

      const overlay = overlaySelections[index] || "none";
      if (overlay === "title" || overlay === "quote") {
        const text = overlay === "title" ? results[index].concept.concept_title : `"${results[index].segment.quote_or_datapoint}"`;
        
        ctx.fillStyle = primaryBrandColor;
        ctx.textAlign = "left";
        ctx.textBaseline = "bottom";
        
        // Soft white shadow for guaranteed contrast against any lines
        ctx.shadowColor = 'rgba(255, 255, 255, 0.9)';
        ctx.shadowBlur = 12;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 2;
        
        const fontSize = overlay === "title" ? Math.floor(canvas.width * 0.055) : Math.floor(canvas.width * 0.045);
        ctx.font = `${overlay === "title" ? 'bold' : 'italic'} ${fontSize}px sans-serif`;
        
        // Text word-wrapping logic
        const maxWidth = canvas.width - (canvas.width * 0.1); 
        const words = text.split(" ");
        let line = "";
        const lines = [];
        
        for (const word of words) {
          const testLine = line + word + " ";
          const metrics = ctx.measureText(testLine);
          if (metrics.width > maxWidth && line !== "") {
            lines.push(line);
            line = word + " ";
          } else {
            line = testLine;
          }
        }
        lines.push(line);

        const lineHeight = fontSize * 1.4;
        let y = canvas.height - (canvas.height * 0.06);
        
        // Draw lines from bottom up
        const paddingLeft = canvas.width * 0.06;
        for (let i = lines.length - 1; i >= 0; i--) {
          // Draw text stroke/shadow manually by double-filling if needed, but shadowColor handles it
          ctx.fillText(lines[i].trim(), paddingLeft, y);
          y -= lineHeight;
        }
      }

      // Convert combined canvas to data
      const dataUrl = canvas.toDataURL("image/png");
      
      if (action === 'download') {
        const a = document.createElement("a");
        a.href = dataUrl;
        a.download = `visual-${index}.png`;
        a.click();
      } else if (action === 'drive') {
        fetch(`${API_BASE}/api/save-to-drive`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ image_data_url: dataUrl }),
        })
        .then(res => res.json())
        .then(data => {
          if (data.status === "success") {
            alert(`Saved! View file here: ${data.link}`);
          } else {
            alert("Failed to save to Drive: " + (data.message || JSON.stringify(data.detail) || JSON.stringify(data)));
          }
        })
        .catch(e => {
          console.error(e);
          alert("Error communicating with backend.");
        })
        .finally(() => setIsSavingToDriveIndex(null));
      }
    };
    
    img.onerror = () => {
      if (action === 'drive') setIsSavingToDriveIndex(null);
      alert("Error exporting image due to cross-origin policies. Saving original instead.");
      if (action === 'download') {
        const a = document.createElement("a");
        a.href = url;
        a.download = `visual-${index}.png`;
        a.click();
      }
    };
  };

  const handleRegenerateSingle = async (index: number) => {
    setIsRegeneratingIndex(index);
    try {
      const prompt = results[index].review.refined_prompt;
      const res = await fetch(`${API_BASE}/api/generate-images`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompts: [prompt] }),
      });
      const data = await res.json();
      if (data.image_urls && data.image_urls.length > 0) {
        setFinalImages(prev => {
          const updated = [...prev];
          updated[index] = data.image_urls[0];
          return updated;
        });
      }
    } catch (e) {
      console.error(e);
      alert("Error regenerating image.");
    } finally {
      setIsRegeneratingIndex(null);
    }
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const file = e.target.files[0];
    
    setIsExtractingColors(true);
    try {
      const formData = new FormData();
      formData.append("logo_file", file);
      const res = await fetch(`${API_BASE}/api/extract-colors`, {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (data.status === "success" && data.colors) {
        setBrandColors(data.colors);
      } else {
        alert("Failed to extract colors: " + (data.message || "Unknown error"));
      }
    } catch (err) {
      console.error(err);
      alert("Error contacting the extraction API.");
    } finally {
      setIsExtractingColors(false);
    }
  };

  const handleProcess = async () => {
    setIsProcessing(true);
    try {
      const formData = new FormData();
      const blob = new Blob([scriptText], { type: "text/plain" });
      formData.append("script_file", blob, "script.txt");
      formData.append("brand_colors", brandColors);
      formData.append("num_outputs", numOutputs.toString());
      formData.append("design_style", designStyle);

      const res = await fetch(`${API_BASE}/api/process-script`, {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      setResults(data.results || []);
    } catch (e) {
      console.error(e);
      alert("Error processing script. Make sure FastAPI backend is running on port 8000.");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleGenerate = async () => {
    setIsGenerating(true);
    try {
      const prompts = results.map(r => r.review.refined_prompt);
      const res = await fetch(`${API_BASE}/api/generate-images`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompts }),
      });
      const data = await res.json();
      setFinalImages(data.image_urls || []);
    } catch (e) {
      console.error(e);
      alert("Error generating images.");
    } finally {
      setIsGenerating(false);
    }
  };

  return (
      <main className="min-h-screen max-w-5xl mx-auto py-12 px-6">
        <header className="mb-12">
          <h1 className="text-3xl font-bold tracking-tight mb-2">Podcast Visualizer AI</h1>
          <p className="text-brand-muted">Turn your audio scripts into scroll-stopping minimalist visuals.</p>
        </header>

        {/* Phase 1: Ingestion */}
        {results.length === 0 && (
          <section className="card space-y-6">
            <div>
              <label className="block text-sm font-medium mb-2">Paste Podcast Script</label>
              <textarea 
                className="input-field h-64 font-mono text-sm"
                placeholder="Speaker 1: Welcome to the podcast..."
                value={scriptText}
                onChange={(e) => setScriptText(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Upload Brand Logo (Auto-extract colors)</label>
              <input 
                type="file"
                accept="image/*"
                className="input-field"
                onChange={handleLogoUpload}
                disabled={isExtractingColors}
              />
              {isExtractingColors && <p className="text-xs text-brand-muted mt-2">Extracting brand colors via Gemini Vision...</p>}
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Brand Colors (Hex, comma separated)</label>
              <input 
                type="text"
                className="input-field"
                value={brandColors}
                onChange={(e) => setBrandColors(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Design Style Aesthetic</label>
              <select 
                className="input-field" 
                value={designStyle}
                onChange={(e) => setDesignStyle(e.target.value)}
              >
                <option value="3D Minimalist">3D Minimalist (Corporate, pristine lighting)</option>
                <option value="Flat Illustration">Flat Illustration (Playful, vector-style)</option>
                <option value="Hand-drawn Sketch">Hand-drawn Sketch (Organic, pen & ink)</option>
                <option value="Cinematic Photography">Cinematic Photography (Realistic, moody)</option>
                <option value="Lo-Fi Blueprint">Lo-Fi Blueprint (Technical schematic, grid lines)</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Number of Visuals</label>
              <input 
                type="number"
                min="1"
                max="15"
                className="input-field"
                value={numOutputs}
                onChange={(e) => setNumOutputs(Number(e.target.value))}
              />
            </div>
            <button 
              className="btn-primary w-full"
              disabled={isProcessing || !scriptText}
              onClick={handleProcess}
            >
              {isProcessing ? "Agents are thinking..." : "Extract Insights & Design"}
            </button>
          </section>
        )}

        {/* Phase 2: Review & Feedback */}
        {results.length > 0 && finalImages.length === 0 && (
          <section className="space-y-8">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-semibold">Suggested Visual Concepts</h2>
              <button 
                className="btn-primary" 
                onClick={handleGenerate}
                disabled={isGenerating}
              >
                {isGenerating ? "Generating Art..." : "Approve & Generate Images"}
              </button>
            </div>
            <div className="grid gap-6">
              {results.map((r, i) => (
                <div key={i} className="card grid md:grid-cols-2 gap-8">
                  <div>
                    <span className="text-xs font-semibold uppercase tracking-wider text-brand-muted">The Moment</span>
                    <blockquote className="my-3 text-lg italic border-l-2 border-brand-accent pl-4">
                      "{r.segment.quote_or_datapoint}"
                    </blockquote>
                    <p className="text-sm text-brand-muted">Timestamp: {r.segment.timestamp}</p>
                  </div>
                  <div>
                    <span className="text-xs font-semibold uppercase tracking-wider text-brand-muted">The Vision: {r.concept.visual_type}</span>
                    <h3 className="font-medium text-lg mt-1 mb-2">{r.concept.concept_title}</h3>
                    <p className="text-sm text-brand-muted mb-4">{r.concept.detailed_description}</p>
                    <div className="bg-brand-surface p-3 rounded-md text-xs font-mono text-brand-muted overflow-x-auto">
                      {r.review.refined_prompt}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Phase 3: Final Execution Images */}
        {finalImages.length > 0 && (
          <section>
            <h2 className="text-2xl font-semibold mb-6">Generated Assets</h2>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {finalImages.map((url, i) => (
                <div key={i} className="card p-4 overflow-hidden bg-brand-surface flex flex-col justify-between">
                  <div>
                    <div className="relative mb-3">
                      <img src={url} alt={`Generated Visual ${i}`} className="w-full h-auto rounded-lg object-cover" />
                      {(!overlaySelections[i] || overlaySelections[i] !== 'none') && overlaySelections[i] && (
                        <div className="absolute inset-0 flex items-end p-6 pointer-events-none">
                          <p 
                            className={`leading-tight drop-shadow-lg ${overlaySelections[i] === 'title' ? 'font-bold text-2xl' : 'italic text-lg'}`}
                            style={{ 
                              color: primaryBrandColor,
                              textShadow: '0px 2px 14px rgba(255,255,255,0.9), 0px 0px 4px rgba(255,255,255,0.7)'
                            }}
                          >
                            {overlaySelections[i] === 'title' ? results[i].concept.concept_title : `"${results[i].segment.quote_or_datapoint}"`}
                          </p>
                        </div>
                      )}
                    </div>
                    
                    <div className="flex gap-2 mb-4">
                      <button 
                        className={`text-xs px-3 py-1.5 rounded-md transition-colors ${!overlaySelections[i] || overlaySelections[i] === 'none' ? 'bg-brand-accent text-white' : 'bg-brand-surface border border-brand-accent/20 text-brand-muted hover:text-white'}`}
                        onClick={() => setOverlaySelections(p => ({...p, [i]: 'none'}))}
                      >No Overlay</button>
                      <button 
                        className={`text-xs px-3 py-1.5 rounded-md transition-colors ${overlaySelections[i] === 'title' ? 'bg-brand-accent text-white' : 'bg-brand-surface border border-brand-accent/20 text-brand-muted hover:text-white'}`}
                        onClick={() => setOverlaySelections(p => ({...p, [i]: 'title'}))}
                      >Title</button>
                      <button 
                        className={`text-xs px-3 py-1.5 rounded-md transition-colors ${overlaySelections[i] === 'quote' ? 'bg-brand-accent text-white' : 'bg-brand-surface border border-brand-accent/20 text-brand-muted hover:text-white'}`}
                        onClick={() => setOverlaySelections(p => ({...p, [i]: 'quote'}))}
                      >Quote</button>
                    </div>

                    {results[i] && (
                      <div className="mb-4">
                        <h4 className="font-semibold text-lg">{results[i].concept.concept_title}</h4>
                        <p className="text-sm text-brand-muted mt-1 mb-3">{results[i].concept.detailed_description}</p>
                        <blockquote className="text-sm italic border-l-2 border-brand-accent pl-3 text-brand-muted">
                          "{results[i].segment.quote_or_datapoint}"
                        </blockquote>
                      </div>
                    )}
                  </div>
                  <div className="flex flex-col gap-3 mt-4 pt-4 border-t border-brand-accent/20">
                    <div className="flex gap-3">
                      <button 
                        onClick={() => handleCompositeAction(i, url, 'download')}
                        className="px-3 py-2 bg-brand-accent/10 hover:bg-brand-accent/20 text-brand-accent rounded-md text-sm transition-colors flex-1 text-center font-medium"
                      >
                        Download
                      </button>
                      <button 
                        onClick={() => handleRegenerateSingle(i)}
                        disabled={isRegeneratingIndex === i}
                        className="px-3 py-2 border border-brand-accent/20 hover:bg-brand-accent/5 rounded-md text-sm transition-colors flex-1 text-center disabled:opacity-50"
                      >
                        {isRegeneratingIndex === i ? "Working..." : "Regenerate"}
                      </button>
                    </div>
                    <button 
                      onClick={() => handleCompositeAction(i, url, 'drive')}
                      disabled={isSavingToDriveIndex === i}
                      className="px-3 py-2 border border-brand-surface hover:border-brand-accent text-brand-muted hover:text-white rounded-md text-sm transition-colors w-full text-center disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4"><path d="M19.125 15.187l-2.906-5.062a.465.465 0 00-.406-.234h-7.625l4.031 7.047h7.266a.469.469 0 00.406-.234.469.469 0 00-.766-.517.469.469 0 000 0z" /><path d="M7.656 16.406l-4.047-7.047a.469.469 0 000 0h-.016l-2.89 5.063c-.14.266.031.563.344.578h13.438l-4.047-7.046a.469.469 0 000 0L7.656 16.406zM8.078 9.89L4.062 2.844c-.156-.266.016-.547.313-.563h5.812a.469.469 0 01.406.234l7.141 12.438a.469.469 0 010 0l-4.047-7.047-.016-.016h-5.594z" /></svg>
                      {isSavingToDriveIndex === i ? "Uploading to Drive..." : "Save to Google Drive"}
                    </button>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-12 text-center">
              <button 
                className="btn-secondary"
                onClick={() => { setResults([]); setFinalImages([]); setScriptText(""); }}
              >
                Start New Script
              </button>
            </div>
          </section>
        )}
      </main>
  );
}
