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
  const [selectedIndices, setSelectedIndices] = useState<number[]>([]);
  
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
      const newResults = data.results || [];
      setResults(newResults);
      setSelectedIndices(newResults.map((_: any, i: number) => i));
    } catch (e) {
      console.error(e);
      alert("Error processing script. Make sure FastAPI backend is running on port 8000.");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleGenerate = async () => {
    if (selectedIndices.length === 0) {
      alert("Please select at least one insight to generate an image for.");
      return;
    }
    setIsGenerating(true);
    try {
      const promptsToGen = selectedIndices.map(index => ({
          prompt: results[index].review.refined_prompt,
          originalIndex: index
      }));
      const res = await fetch(`${API_BASE}/api/generate-images`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompts: promptsToGen.map(p => p.prompt) }),
      });
      const data = await res.json();
      const urls = data.image_urls || [];
      
      const newFinalImages = Array(results.length).fill("");
      promptsToGen.forEach((p, idx) => {
          newFinalImages[p.originalIndex] = urls[idx] || "";
      });
      setFinalImages(newFinalImages);
    } catch (e) {
      console.error(e);
      alert("Error generating images.");
    } finally {
      setIsGenerating(false);
    }
  };

  return (
      <main className="min-h-screen max-w-5xl mx-auto py-16 px-6 relative animate-fade-in">
        {/* Ambient background glow for Railway/Cursor effect */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-xl h-64 bg-white/5 rounded-full blur-3xl -z-10 pointer-events-none"></div>

        <header className="mb-16 text-center">
          <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight mb-4 bg-clip-text text-transparent bg-gradient-to-b from-white to-brand-muted drop-shadow-[0_0_25px_rgba(255,255,255,0.15)]">
            Podcast Visualizer AI
          </h1>
          <p className="text-brand-muted text-lg max-w-2xl mx-auto">
            Turn your audio scripts into scroll-stopping minimalist visuals.
          </p>
        </header>

        {/* Phase 1: Ingestion */}
        {results.length === 0 && (
          <section className="card card-glow border-t border-t-[rgba(255,255,255,0.15)] space-y-8 max-w-3xl mx-auto animate-fade-in relative z-10">
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
              <label className="block text-sm font-medium mb-3 text-brand-text/80">Refined Aesthetic</label>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {[
                  { id: "3D Minimalist", label: "3D Minimalist", desc: "Corporate, pristine" },
                  { id: "Flat Illustration", label: "Flat Illustration", desc: "Playful, vector" },
                  { id: "Hand-drawn Sketch", label: "Hand-drawn", desc: "Organic pen & ink" },
                  { id: "Cinematic Photography", label: "Cinematic", desc: "Realistic moody" },
                  { id: "Lo-Fi Blueprint", label: "Blueprint", desc: "Technical grid" },
                ].map(style => (
                  <button 
                    key={style.id} 
                    type="button"
                    onClick={() => setDesignStyle(style.id)} 
                    className={`flex flex-col items-start p-4 rounded-xl border transition-all duration-200 active:scale-95 group ${designStyle === style.id ? 'border-brand-accent bg-brand-accent/[0.05] shadow-[0_0_20px_rgba(204,255,0,0.15)] text-brand-text' : 'border-card-border bg-black/40 hover:bg-brand-accent/[0.02] hover:border-brand-accent/50 text-brand-muted hover:text-brand-text'}`}
                  >
                    <span className={`font-semibold text-sm mb-1 transition-colors ${designStyle === style.id ? 'text-brand-accent' : 'group-hover:text-white'}`}>{style.label}</span>
                    <span className="text-[11px] leading-tight opacity-70 text-left">{style.desc}</span>
                  </button>
                ))}
              </div>
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
              className="btn-primary w-full mt-4 h-14 text-base tracking-widest mt-8 flex justify-center items-center gap-3 group"
              disabled={isProcessing || !scriptText}
              onClick={handleProcess}
            >
              {isProcessing ? (
                <>
                  <svg className="animate-spin h-5 w-5 text-black" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                  Agents are thinking...
                </>
              ) : (
                <>Extract Insights & Design</>
              )}
            </button>
          </section>
        )}

        {/* Phase 2: Review & Feedback */}
        {results.length > 0 && !finalImages.some(url => url) && (
          <section className="space-y-8 animate-fade-in relative z-10">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
              <div>
                <h2 className="text-3xl font-bold tracking-tight">Select Concepts</h2>
                <p className="text-brand-muted mt-1">Review the AI's creative direction for each segment.</p>
              </div>
              <button 
                className="btn-primary py-4 px-8 shadow-[0_0_20px_rgba(255,255,255,0.2)]" 
                onClick={handleGenerate}
                disabled={isGenerating}
              >
                {isGenerating ? "Forging Images..." : "Generate Selected Visuals"}
              </button>
            </div>
            <div className="grid gap-6">
              {results.map((r, i) => (
                <div key={i} className={`card card-glow relative transition-all duration-500 ${selectedIndices.includes(i) ? 'border-brand-accent/50 shadow-[0_0_40px_rgba(204,255,0,0.1)] translate-y-[-2px]' : 'border-card-border bg-black/40 backdrop-blur-none scale-[0.98]'}`}>
                  <div 
                    className="absolute top-6 right-6 z-20 flex items-center gap-3 bg-[rgba(10,10,10,0.8)] backdrop-blur-md px-4 py-2 rounded-full border border-[rgba(255,255,255,0.1)] shadow-lg cursor-pointer hover:border-brand-accent hover:bg-black transition-all active:scale-95 group" 
                    onClick={() => {
                        if (selectedIndices.includes(i)) setSelectedIndices(prev => prev.filter(idx => idx !== i));
                        else setSelectedIndices(prev => [...prev, i]);
                    }}
                  >
                    <span className={`text-[10px] font-bold uppercase tracking-widest select-none transition-colors ${selectedIndices.includes(i) ? 'text-brand-accent' : 'text-brand-muted group-hover:text-white'}`}>
                        {selectedIndices.includes(i) ? 'Included' : 'Skipped'}
                    </span>
                    <div className={`w-10 h-5 rounded-full transition-all duration-300 relative ${selectedIndices.includes(i) ? 'bg-brand-accent shadow-[0_0_10px_rgba(204,255,0,0.5)]' : 'bg-brand-muted/30 group-hover:bg-brand-muted/50'}`}>
                        <div className={`absolute top-0.5 w-4 h-4 rounded-full transition-all duration-300 ${selectedIndices.includes(i) ? 'bg-black left-[22px]' : 'bg-brand-text/50 left-0.5'}`}></div>
                    </div>
                  </div>
                  <div className="grid md:grid-cols-2 gap-10 mt-2">
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-widest text-brand-muted opacity-80">The Moment</span>
                    <blockquote className="my-4 text-xl font-medium italic border-l-[3px] border-brand-accent/30 pl-5 py-1 text-brand-text">
                      "{r.segment.quote_or_datapoint}"
                    </blockquote>
                    <p className="text-xs font-mono text-brand-muted opacity-70 mt-6">Timestamp: {r.segment.timestamp}</p>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-widest text-brand-muted opacity-80">The Vision: <span className="text-brand-text">{r.concept.visual_type}</span></span>
                    <h3 className="font-semibold text-2xl mt-3 mb-2 text-brand-text tracking-tight">{r.concept.concept_title}</h3>
                    <p className="text-sm text-brand-muted mb-5 leading-relaxed">{r.concept.detailed_description}</p>
                    <div className="bg-[rgba(0,0,0,0.3)] border border-[rgba(255,255,255,0.05)] p-4 rounded-xl text-xs font-mono text-brand-muted/80 overflow-x-auto shadow-inner leading-relaxed">
                      {r.review.refined_prompt}
                    </div>
                  </div>
                </div>
              </div>
              ))}
            </div>
          </section>
        )}

        {/* Phase 3: Final Execution Images */}
        {finalImages.some(url => url) && (
          <section className="animate-fade-in relative z-10">
            <h2 className="text-3xl font-bold tracking-tight mb-8">Generated Assets</h2>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {finalImages.map((url, i) => {
                if (!url) return null;
                return (
                  <div key={i} className="card p-0 overflow-hidden flex flex-col justify-between group bg-transparent">
                  <div className="p-4">
                    <div className="relative mb-5 rounded-xl overflow-hidden shadow-2xl bg-[#000]">
                      <img src={url} alt={`Generated Visual ${i}`} className="w-full h-auto object-cover group-hover:scale-105 transition-transform duration-700 ease-out" />
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
                    
                    <div className="flex gap-2 mb-6">
                      <button 
                        className={`text-xs px-4 py-2 rounded-lg transition-all active:scale-90 font-bold border ${!overlaySelections[i] || overlaySelections[i] === 'none' ? 'bg-brand-accent text-black border-brand-accent shadow-[0_0_15px_rgba(204,255,0,0.3)]' : 'bg-transparent border-card-border text-brand-muted hover:border-brand-accent/50 hover:text-white'}`}
                        onClick={() => setOverlaySelections(p => ({...p, [i]: 'none'}))}
                      >Image Only</button>
                      <button 
                        className={`text-xs px-4 py-2 rounded-lg transition-all active:scale-90 font-bold border ${overlaySelections[i] === 'title' ? 'bg-brand-accent text-black border-brand-accent shadow-[0_0_15px_rgba(204,255,0,0.3)]' : 'bg-transparent border-card-border text-brand-muted hover:border-brand-accent/50 hover:text-white'}`}
                        onClick={() => setOverlaySelections(p => ({...p, [i]: 'title'}))}
                      >+ Title</button>
                      <button 
                        className={`text-xs px-4 py-2 rounded-lg transition-all active:scale-90 font-bold border ${overlaySelections[i] === 'quote' ? 'bg-brand-accent text-black border-brand-accent shadow-[0_0_15px_rgba(204,255,0,0.3)]' : 'bg-transparent border-card-border text-brand-muted hover:border-brand-accent/50 hover:text-white'}`}
                        onClick={() => setOverlaySelections(p => ({...p, [i]: 'quote'}))}
                      >+ Quote</button>
                    </div>

                    {results[i] && (
                      <div className="mb-2">
                        <h4 className="font-bold text-lg text-brand-text mb-1 tracking-tight">{results[i].concept.concept_title}</h4>
                        <p className="text-xs text-brand-muted opacity-80 mb-4">{results[i].concept.detailed_description}</p>
                      </div>
                    )}
                  </div>
                  <div className="flex flex-col gap-3 p-4 bg-black/50 border-t border-card-border">
                    <div className="flex gap-3">
                      <button 
                        onClick={() => handleCompositeAction(i, url, 'download')}
                        className="px-4 py-2.5 bg-brand-accent/[0.05] border border-brand-accent/20 hover:bg-brand-accent hover:text-black hover:shadow-[0_0_20px_rgba(204,255,0,0.4)] text-brand-accent rounded-lg text-sm transition-all active:scale-95 focus:ring-2 focus:ring-brand-accent/50 flex-1 font-bold text-center"
                      >
                        Download
                      </button>
                      <button 
                        onClick={() => handleRegenerateSingle(i)}
                        disabled={isRegeneratingIndex === i}
                        className="px-4 py-2.5 bg-transparent border border-card-border hover:border-brand-accent/50 rounded-lg text-sm transition-all active:scale-95 flex-1 text-center disabled:opacity-50 text-white hover:bg-brand-accent/[0.02]"
                      >
                        {isRegeneratingIndex === i ? (
                            <span className="flex items-center justify-center gap-2 text-brand-accent">
                                <svg className="animate-spin h-3.5 w-3.5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                            </span>
                        ) : "Regenerate"}
                      </button>
                    </div>
                    <button 
                      onClick={() => handleCompositeAction(i, url, 'drive')}
                      disabled={isSavingToDriveIndex === i}
                      className="px-4 py-2.5 bg-transparent border border-card-border hover:border-brand-accent/50 text-brand-muted hover:text-white rounded-lg text-sm transition-all active:scale-95 w-full text-center disabled:opacity-50 flex items-center justify-center gap-2 hover:bg-brand-accent/[0.02] group"
                    >
                      <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4 group-hover:text-brand-accent transition-colors"><path d="M19.125 15.187l-2.906-5.062a.465.465 0 00-.406-.234h-7.625l4.031 7.047h7.266a.469.469 0 00.406-.234.469.469 0 00-.766-.517.469.469 0 000 0z" /><path d="M7.656 16.406l-4.047-7.047a.469.469 0 000 0h-.016l-2.89 5.063c-.14.266.031.563.344.578h13.438l-4.047-7.046a.469.469 0 000 0L7.656 16.406zM8.078 9.89L4.062 2.844c-.156-.266.016-.547.313-.563h5.812a.469.469 0 01.406.234l7.141 12.438a.469.469 0 010 0l-4.047-7.047-.016-.016h-5.594z" /></svg>
                      {isSavingToDriveIndex === i ? "Uploading to Drive..." : "Save to Google Drive"}
                    </button>
                  </div>
                </div>
                );
              })}
            </div>
            <div className="mt-12 text-center">
              <button 
                className="btn-secondary"
                onClick={() => { setResults([]); setFinalImages([]); setScriptText(""); setSelectedIndices([]); }}
              >
                Start New Script
              </button>
            </div>
          </section>
        )}
      </main>
  );
}
