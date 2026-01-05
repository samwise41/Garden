import React, { useState, useEffect } from 'react';
import { DndContext, useDraggable, useDroppable } from '@dnd-kit/core';
import { Save, Upload, Plus, Settings } from 'lucide-react';
import { savePlantToGithub } from './githubSync';

// --- Components ---

// 1. The Sidebar Item (Draggable)
function DraggablePlant({ plant }) {
  const { attributes, listeners, setNodeRef, transform } = useDraggable({
    id: `sidebar-${plant.id}`,
    data: { plant }
  });
  
  const style = transform ? {
    transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
  } : undefined;

  return (
    <div ref={setNodeRef} style={style} {...listeners} {...attributes} 
         className="p-3 bg-white mb-2 rounded shadow cursor-move flex items-center gap-2 border hover:bg-gray-50">
      <span className="text-xl">{plant.icon}</span>
      <div>
        <p className="font-bold text-sm">{plant.name}</p>
        <p className="text-xs text-gray-500">{plant.spacing}" spacing</p>
      </div>
    </div>
  );
}

// 2. The Bed Spot (Where plants land)
function PlantInstance({ instance, plantDef, onDelete }) {
  // Calculate Position
  // Lane 0 (Top) = 25% from top. Lane 1 (Bottom) = 75% from top.
  // Single Row (rows=1) = 50% from top (Center).
  let topPos = '25%';
  if (plantDef.rows === 1) topPos = '50%';
  else if (instance.lane === 1) topPos = '75%';

  // Convert Inches to Pixels (1 inch = 10px for visualization)
  const pxPerInch = 10;
  const sizePx = plantDef.spacing * pxPerInch;
  
  return (
    <div 
      className={`absolute flex items-center justify-center rounded-full shadow-md text-2xl cursor-pointer hover:scale-110 transition-transform ${plantDef.color}`}
      style={{
        width: `${sizePx}px`,
        height: `${sizePx}px`,
        left: `${instance.x * pxPerInch}px`,
        top: topPos,
        transform: 'translate(-50%, -50%)', // Center on the coordinate
        opacity: 0.9
      }}
      title={`Click to remove ${plantDef.name}`}
      onClick={() => onDelete(instance.uuid)}
    >
      {plantDef.icon}
    </div>
  );
}

// --- Main Application ---

export default function App() {
  const [plants, setPlants] = useState([]);
  const [layout, setLayout] = useState([]);
  const [showSettings, setShowSettings] = useState(false);
  
  // Load Plant Definitions
  useEffect(() => {
    fetch('/plants.json') // This will now work correctly with the vite.config.js fix
      .then(res => res.json())
      .then(data => setPlants(data))
      .catch(err => console.error("Could not load plants", err));
  }, []);

  // Load/Save Layout to LocalStorage
  useEffect(() => {
    const saved = localStorage.getItem('garden_layout');
    if (saved) setLayout(JSON.parse(saved));
  }, []);

  useEffect(() => {
    localStorage.setItem('garden_layout', JSON.stringify(layout));
  }, [layout]);

  // --- The Core Logic: Dropping a Plant ---
  const handleDragEnd = (event) => {
    const { active, over } = event;
    if (!over) return;

    // Get the plant definition
    const plant = active.data.current.plant;
    
    // Calculate Drop Position (Relative to Bed)
    // In a real app, use ref measurements. Here we simulate for prototype simplicity:
    // We assume the bed is 800px wide (80 inches).
    const dropX = active.rect.current.translated.left - over.rect.left;
    const pxPerInch = 10; // Scale factor
    let inchesX = Math.max(0, Math.round(dropX / pxPerInch));

    // Determine Lane (Top or Bottom) based on vertical drop position
    const dropY = active.rect.current.translated.top - over.rect.top;
    const bedHeight = 200; // 200px tall bed
    let lane = dropY < (bedHeight / 2) ? 0 : 1;

    // --- STAGGER LOGIC ---
    if (plant.stagger && lane === 1) {
      // Check top row (lane 0) for neighbors
      const neighbors = layout.filter(p => p.lane === 0 && Math.abs(p.x - inchesX) < (plant.spacing));
      
      if (neighbors.length > 0) {
        // If neighbor exists directly above, shift this plant right by half spacing
        inchesX += (plant.spacing / 2);
      }
    }

    const newPlant = {
      uuid: crypto.randomUUID(),
      plantId: plant.id,
      x: inchesX,
      lane: plant.rows === 1 ? 0 : lane // Single row always forces lane 0 logic for storage
    };

    setLayout([...layout, newPlant]);
  };

  // --- Export / Import ---
  const handleExport = () => {
    const data = JSON.stringify(layout, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'garden-plan.json';
    a.click();
  };

  const handleImport = (e) => {
    const file = e.target.files[0];
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = JSON.parse(event.target.result);
        // Basic validation could go here
        setLayout(data);
      } catch (err) {
        alert("Invalid JSON file");
      }
    };
    reader.readAsText(file);
  };

  // --- Add Plant Handler ---
  const handleAddPlant = async () => {
    const token = localStorage.getItem('gh_token');
    if (!token) {
      setShowSettings(true);
      return;
    }
    
    // Simple prompt for prototype (replace with Modal in production)
    const name = prompt("Plant Name:");
    if (!name) return;
    const spacing = Number(prompt("Spacing (inches):", "12"));
    
    const newPlant = {
      id: name.toLowerCase(),
      name,
      spacing,
      rows: 2, // Default
      stagger: true,
      color: "bg-blue-500",
      icon: "🌱"
    };

    // User/Repo updated to your specific details:
    const success = await savePlantToGithub(newPlant, 'samwise41', 'Garden', token);
    if (success) {
      setPlants([...plants, newPlant]); // Optimistic update
      alert("Plant added! GitHub pages will update in ~1 min.");
    }
  };

  // --- Render ---
  return (
    <DndContext onDragEnd={handleDragEnd}>
      <div className="flex h-screen bg-stone-100">
        
        {/* Sidebar */}
        <div className="w-80 bg-white border-r p-4 flex flex-col">
          <div className="flex justify-between items-center mb-6">
            <h1 className="text-xl font-bold text-green-800">Garden Planner</h1>
            <button onClick={() => setShowSettings(!showSettings)}><Settings size={20}/></button>
          </div>

          {/* Settings Area */}
          {showSettings && (
            <div className="mb-4 p-2 bg-gray-100 rounded text-sm">
              <p className="mb-1 font-bold">GitHub Token:</p>
              <input 
                type="password" 
                className="w-full p-1 border rounded"
                placeholder="ghp_..."
                onChange={(e) => localStorage.setItem('gh_token', e.target.value)}
              />
            </div>
          )}

          {/* Tools */}
          <div className="flex gap-2 mb-4">
            <button onClick={handleExport} className="flex-1 bg-gray-200 p-2 rounded flex justify-center gap-2 hover:bg-gray-300">
              <Save size={18} /> Save
            </button>
            <label className="flex-1 bg-gray-200 p-2 rounded flex justify-center gap-2 hover:bg-gray-300 cursor-pointer">
              <Upload size={18} /> Load
              <input type="file" className="hidden" accept=".json" onChange={handleImport} />
            </label>
          </div>

          <button onClick={handleAddPlant} className="w-full bg-green-600 text-white p-2 rounded flex items-center justify-center gap-2 mb-4 hover:bg-green-700">
            <Plus size={18} /> Add New Plant
          </button>

          {/* List */}
          <div className="overflow-y-auto flex-1">
            {plants.map(p => (
              <DraggablePlant key={p.id} plant={p} />
            ))}
          </div>
        </div>

        {/* Canvas Area */}
        <div className="flex-1 p-10 overflow-auto">
          <div className="mb-4 text-center">
            <h2 className="text-2xl font-bold text-stone-700">8ft x 4ft Bed</h2>
            <p className="text-stone-500">Drag plants below. 1 grid unit = 1 foot.</p>
          </div>

          {/* The Garden Bed */}
          <DroppableBed layout={layout} plants={plants} setLayout={setLayout} />

        </div>
      </div>
    </DndContext>
  );
}

// 3. The Droppable Area Wrapper
function DroppableBed({ layout, plants, setLayout }) {
  const { setNodeRef } = useDroppable({ id: 'garden-bed' });

  const getPlantDef = (id) => plants.find(p => p.id === id);

  const removePlant = (uuid) => {
    setLayout(layout.filter(l => l.uuid !== uuid));
  };

  return (
    <div 
      ref={setNodeRef}
      className="relative mx-auto bg-amber-100 border-4 border-amber-800 rounded shadow-inner"
      style={{ width: '800px', height: '200px' }} // 800px = 80 inches (approx scale)
    >
      {/* Center Line for visual reference */}
      <div className="absolute w-full border-t-2 border-dashed border-amber-800/30 top-1/2"></div>
      
      {/* Ruler Markers (Every 120px = 1 foot approx if 10px/inch) */}
      {[...Array(8)].map((_, i) => (
        <div key={i} className="absolute top-0 h-full border-l border-amber-900/10 text-xs text-amber-900/50 p-1" style={{left: `${(i+1)*100}px`}}>
          {i+1}'
        </div>
      ))}

      {/* Placed Plants */}
      {layout.map(instance => {
        const def = getPlantDef(instance.plantId);
        if (!def) return null;
        return <PlantInstance key={instance.uuid} instance={instance} plantDef={def} onDelete={removePlant} />;
      })}
    </div>
  );
}
