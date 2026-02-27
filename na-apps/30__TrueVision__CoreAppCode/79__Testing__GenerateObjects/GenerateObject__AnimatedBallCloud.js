import * as THREE from 'three';

// -----------------------------------------------------------------------------
// REGION | Generate Objects - Animated Ball Cloud
// -----------------------------------------------------------------------------

    // FUNCTION | Create Animated Ball Cloud
    // ------------------------------------------------------------
    export function Na__GenerateObject__CreateAnimatedBallCloud(scene, options = {}) {
        const count = Number.isFinite(options.count) ? options.count : 500;
        const diameter = Number.isFinite(options.diameter) ? options.diameter : 0.2;
        const boundsX = Number.isFinite(options.boundsX) ? options.boundsX : 5;
        const boundsY = Number.isFinite(options.boundsY) ? options.boundsY : 3;
        const boundsZ = Number.isFinite(options.boundsZ) ? options.boundsZ : 5;
        const centerY = Number.isFinite(options.centerY) ? options.centerY : 1;
        const speed = Number.isFinite(options.speed) ? options.speed : 0.05;

        const sphereGeometry = new THREE.SphereGeometry(diameter * 0.5, 12, 12);
        const ballClouds = [];
        const ballCloudVelocities = [];

        for (let i = 0; i < count; i++) {
            const ballCloudMaterial = new THREE.MeshStandardMaterial({
                color: new THREE.Color(
                    0.5 + Math.random() * 0.5,
                    0.5 + Math.random() * 0.5,
                    0.5 + Math.random() * 0.5
                )
            });

            const ballCloud = new THREE.Mesh(sphereGeometry, ballCloudMaterial);
            ballCloud.name = `ballCloud${i}`;
            ballCloud.position.set(
                (Math.random() - 0.5) * (boundsX * 2),
                (Math.random() - 0.5) * (boundsY * 2) + centerY,
                (Math.random() - 0.5) * (boundsZ * 2)
            );

            scene.add(ballCloud);
            ballClouds.push(ballCloud);
            ballCloudVelocities.push(
                new THREE.Vector3(
                    (Math.random() - 0.5) * speed,
                    (Math.random() - 0.5) * speed,
                    (Math.random() - 0.5) * speed
                )
            );
        }

        const Na__GenerateObject__UpdateAnimatedBallCloud = () => {
            for (let i = 0; i < count; i++) {
                const ballCloud = ballClouds[i];
                const ballCloudVelocity = ballCloudVelocities[i];

                ballCloud.position.add(ballCloudVelocity);

                if (Math.abs(ballCloud.position.x) > boundsX) ballCloudVelocity.x *= -1;
                if (Math.abs(ballCloud.position.y - centerY) > boundsY) ballCloudVelocity.y *= -1;
                if (Math.abs(ballCloud.position.z) > boundsZ) ballCloudVelocity.z *= -1;
            }
        };

        if (typeof options.registerUpdate === 'function') {
            options.registerUpdate(Na__GenerateObject__UpdateAnimatedBallCloud);
        }

        const Na__GenerateObject__DisposeAnimatedBallCloud = () => {
            ballClouds.forEach((mesh) => {
                scene.remove(mesh);
                if (mesh.material) mesh.material.dispose();
            });
            sphereGeometry.dispose();
        };

        return {
            meshes: ballClouds,
            velocities: ballCloudVelocities,
            update: Na__GenerateObject__UpdateAnimatedBallCloud,
            dispose: Na__GenerateObject__DisposeAnimatedBallCloud
        };
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------