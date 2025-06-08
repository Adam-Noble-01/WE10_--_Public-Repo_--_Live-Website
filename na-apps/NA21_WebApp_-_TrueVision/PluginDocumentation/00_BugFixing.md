# KNOWN BUGS
- HDRI environment texture is not working, it sucks as when enabled it complete breaks the textures
- black shading is not working
- normal map is not working

## **Main Causes of Black Shading Issues:**

### **1. Material and Lighting Problems**
- **Missing Environment Texture**: Babylon.js requires an environment texture (HDR/IBL) for proper PBR material rendering

- **Incorrect Material Properties**: GLB files with missing or incorrectly set diffuse colors (often set to 0,0,0)
- **Missing Vertex Normals**: Geometry exported without proper normal data

### **2. SketchUp-Specific Export Issues**
- **Nested Groups/Components**: Your suspicion is correct - multiple nested containers with materials applied at different levels can cause export issues
- **Material Assignment Hierarchy**: SketchUp's object-level materials don't always translate properly through the GLB export chain
- **"Double-Wrapped" Components**: SketchUp can create inefficient nested structures (component containing a group) that confuse exporters

### **3. Normal Map and Texture Issues**
- **Inverted Normal Maps**: Y-axis flipping is common in GLB files, causing surfaces to appear lit from below/inside
- **Incorrect Texture Encoding**: Color textures need sRGB encoding, normal maps need linear encoding
- **Missing or Corrupted UV Coordinates**: Geometry without proper UV mapping appears black

## **Solutions You Should Implement:**

### **1. Pre-Export SketchUp Processing Script**
You should indeed write a script to flatten your model before GLB export:

```ruby
# Flatten nested materials and apply to faces
def flatten_model_materials
  model = Sketchup.active_model
  
  model.entities.each do |entity|
    if entity.is_a?(Sketchup::Group) || entity.is_a?(Sketchup::ComponentInstance)
      # Apply group/component material to all child faces
      apply_material_to_faces(entity)
    end
  end
end

def apply_material_to_faces(container)
  return unless container.material
  
  # Apply container material to all faces inside
  container.definition.entities.each do |face|
    if face.is_a?(Sketchup::Face) && !face.material
      face.material = container.material
    end
  end
end
```

### **2. Babylon.js Environment Setup**
Add proper environment lighting:

```javascript
// Add HDR environment texture
const hdrTexture = new BABYLON.HDRCubeTexture("path/to/environment.hdr", scene, 256);
scene.environmentTexture = hdrTexture;

// Set appropriate environment intensity
scene.environmentIntensity = 1.0;

// Add fallback directional light
const light = new BABYLON.DirectionalLight("light", new BABYLON.Vector3(-1, -1, -1), scene);
light.intensity = 0.5;
```

### **3. Material Validation Script**
Create a script to check and fix material issues:

```javascript
// Check for black materials after GLB load
scene.materials.forEach(material => {
    if (material.albedoColor && material.albedoColor.r === 0 && 
        material.albedoColor.g === 0 && material.albedoColor.b === 0) {
        // Fix black diffuse color
        material.albedoColor = new BABYLON.Color3(0.8, 0.8, 0.8);
    }
});
```

### **4. Normal Map Fixing**
If using normal maps, ensure proper orientation:

```javascript
// Fix inverted normals
if (material.bumpTexture) {
    material.invertNormalMapX = false;
    material.invertNormalMapY = true;  // Common fix for SketchUp exports
}
```

## **Recommended Workflow:**

1. **In SketchUp**: Run a pre-processing script to flatten nested materials
2. **Export Settings**: Use GLB export with proper material settings
3. **In Babylon.js**: Add environment texture and validate materials on load
4. **Test**: Use tools like gltf.report to validate your GLB files before use

The black shading is almost certainly due to the combination of nested SketchUp groups/components with materials applied at different levels, missing environment lighting in Babylon.js, and potentially inverted normal maps. Your instinct about needing a SketchUp preprocessing script is spot-on!




