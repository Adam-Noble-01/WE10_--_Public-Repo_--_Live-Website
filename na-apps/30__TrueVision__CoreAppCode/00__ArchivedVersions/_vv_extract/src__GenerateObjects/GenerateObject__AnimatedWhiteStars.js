// #Region ------------------------------------------------
// GENERATE OBJECTS | Scatter and animate white stars
// --------------------------------------------------------
const whiteStarCount = 500;
const whiteStars = [];
const whiteStarVelocities = [];

for (let i = 0; i < whiteStarCount; i++) {
    const whiteStar = BABYLON.MeshBuilder.CreateSphere("whiteStar" + i, { diameter: 0.2 }, scene);
    whiteStar.position.x = (Math.random() - 0.5) * 10;
    whiteStar.position.y = (Math.random() - 0.5) * 5 + 1;
    whiteStar.position.z = (Math.random() - 0.5) * 10;

    const whiteStarMat = new BABYLON.StandardMaterial("whiteStarMat" + i, scene);
    whiteStarMat.diffuseColor = new BABYLON.Color3(1, 1, 1);
    whiteStarMat.emissiveColor = new BABYLON.Color3(1, 1, 1);
    whiteStarMat.specularColor = new BABYLON.Color3(0, 0, 0);
    whiteStar.material = whiteStarMat;

    // Random velocity
    // ------------------------------------
    whiteStarVelocities.push(new BABYLON.Vector3(
        (Math.random() - 0.5) * 0.05,
        (Math.random() - 0.5) * 0.05,
        (Math.random() - 0.5) * 0.05
    ));

    whiteStars.push(whiteStar);
}

// Animate stars each frame
// ------------------------------------
scene.registerBeforeRender(() => {
    for (let i = 0; i < whiteStarCount; i++) {
        const whiteStar = whiteStars[i];
        const whiteStarVel = whiteStarVelocities[i];

        whiteStar.position.addInPlace(whiteStarVel);

        // Bounce back when reaching the bounds
        // ------------------------------------
        if (Math.abs(whiteStar.position.x) > 5) whiteStarVel.x *= -1;
        if (Math.abs(whiteStar.position.y - 1) > 3) whiteStarVel.y *= -1;
        if (Math.abs(whiteStar.position.z) > 5) whiteStarVel.z *= -1;
    }
});

// #endregion ---------------------------------------------

