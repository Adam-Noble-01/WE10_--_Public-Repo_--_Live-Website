// #Region ------------------------------------------------
// GENERATE OBJECTS | Scatter and animate spheres
// --------------------------------------------------------
const ballCloudCount = 500;
const ballClouds = [];
const ballCloudVelocities = [];

for (let i = 0; i < ballCloudCount; i++) {
    const ballCloud = BABYLON.MeshBuilder.CreateSphere("ballCloud" + i, { diameter: 0.2 }, scene);
    ballCloud.position.x = (Math.random() - 0.5) * 10;
    ballCloud.position.y = (Math.random() - 0.5) * 5 + 1;
    ballCloud.position.z = (Math.random() - 0.5) * 10;

    const ballCloudMat = new BABYLON.StandardMaterial("ballCloudMat" + i, scene);
    ballCloudMat.diffuseColor = new BABYLON.Color3(
        0.5 + Math.random() * 0.5,
        0.5 + Math.random() * 0.5,
        0.5 + Math.random() * 0.5
    );
    ballCloud.material = ballCloudMat;

    // Random velocity
    // ------------------------------------
    ballCloudVelocities.push(new BABYLON.Vector3(
        (Math.random() - 0.5) * 0.05,
        (Math.random() - 0.5) * 0.05,
        (Math.random() - 0.5) * 0.05
    ));

    ballClouds.push(ballCloud);
}

// Animate spheres each frame
// ------------------------------------
scene.registerBeforeRender(() => {
    for (let i = 0; i < ballCloudCount; i++) {
        const ballCloud = ballClouds[i];
        const ballCloudVel = ballCloudVelocities[i];

        ballCloud.position.addInPlace(ballCloudVel);

        // Bounce back when reaching the bounds
        // ------------------------------------
        if (Math.abs(ballCloud.position.x) > 5) ballCloudVel.x *= -1;
        if (Math.abs(ballCloud.position.y - 1) > 3) ballCloudVel.y *= -1;
        if (Math.abs(ballCloud.position.z) > 5) ballCloudVel.z *= -1;
    }
});

// #endregion ---------------------------------------------