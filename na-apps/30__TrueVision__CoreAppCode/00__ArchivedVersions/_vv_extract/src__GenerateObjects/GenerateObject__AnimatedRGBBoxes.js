// #Region ------------------------------------------------
// GENERATE OBJECTS | Scatter and animate RGB boxes
// --------------------------------------------------------
const rgbBoxCount = 500;
const rgbBoxes = [];
const rgbBoxVelocities = [];

// RGB color values
// ------------------------------------
const rgbBoxColors = [
    new BABYLON.Color3(1, 0, 0), // Red
    new BABYLON.Color3(0, 1, 0), // Green
    new BABYLON.Color3(0, 0, 1)  // Blue
];

for (let i = 0; i < rgbBoxCount; i++) {
    const rgbBox = BABYLON.MeshBuilder.CreateBox("rgbBox" + i, { size: 0.2 }, scene);
    rgbBox.position.x = (Math.random() - 0.5) * 10;
    rgbBox.position.y = (Math.random() - 0.5) * 5 + 1;
    rgbBox.position.z = (Math.random() - 0.5) * 10;

    const rgbBoxMat = new BABYLON.StandardMaterial("rgbBoxMat" + i, scene);
    const rgbBoxColorIndex = i % 3;
    rgbBoxMat.diffuseColor = rgbBoxColors[rgbBoxColorIndex];
    rgbBoxMat.emissiveColor = rgbBoxColors[rgbBoxColorIndex];
    rgbBox.material = rgbBoxMat;

    // Random velocity
    // ------------------------------------
    rgbBoxVelocities.push(new BABYLON.Vector3(
        (Math.random() - 0.5) * 0.05,
        (Math.random() - 0.5) * 0.05,
        (Math.random() - 0.5) * 0.05
    ));

    rgbBoxes.push(rgbBox);
}

// Animate boxes each frame
// ------------------------------------
scene.registerBeforeRender(() => {
    for (let i = 0; i < rgbBoxCount; i++) {
        const rgbBox = rgbBoxes[i];
        const rgbBoxVel = rgbBoxVelocities[i];

        rgbBox.position.addInPlace(rgbBoxVel);

        // Bounce back when reaching the bounds
        // ------------------------------------
        if (Math.abs(rgbBox.position.x) > 5) rgbBoxVel.x *= -1;
        if (Math.abs(rgbBox.position.y - 1) > 3) rgbBoxVel.y *= -1;
        if (Math.abs(rgbBox.position.z) > 5) rgbBoxVel.z *= -1;
    }
});

// #endregion ---------------------------------------------

