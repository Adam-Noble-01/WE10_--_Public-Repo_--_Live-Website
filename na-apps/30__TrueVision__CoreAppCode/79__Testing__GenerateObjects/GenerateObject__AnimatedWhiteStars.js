import * as THREE from 'three';

// -----------------------------------------------------------------------------
// REGION | Generate Objects - Animated White Stars
// -----------------------------------------------------------------------------

    // FUNCTION | Create Animated White Stars
    // ------------------------------------------------------------
    export function Na__GenerateObject__CreateAnimatedWhiteStars(scene, options = {}) {
        const count = Number.isFinite(options.count) ? options.count : 500;
        const diameter = Number.isFinite(options.diameter) ? options.diameter : 0.2;
        const boundsX = Number.isFinite(options.boundsX) ? options.boundsX : 5;
        const boundsY = Number.isFinite(options.boundsY) ? options.boundsY : 3;
        const boundsZ = Number.isFinite(options.boundsZ) ? options.boundsZ : 5;
        const centerY = Number.isFinite(options.centerY) ? options.centerY : 1;
        const speed = Number.isFinite(options.speed) ? options.speed : 0.05;

        const sphereGeometry = new THREE.SphereGeometry(diameter * 0.5, 12, 12);
        const whiteStars = [];
        const whiteStarVelocities = [];

        for (let i = 0; i < count; i++) {
            const whiteStarMaterial = new THREE.MeshPhongMaterial({
                color: new THREE.Color(1, 1, 1),
                emissive: new THREE.Color(1, 1, 1),
                specular: new THREE.Color(0, 0, 0)
            });

            const whiteStar = new THREE.Mesh(sphereGeometry, whiteStarMaterial);
            whiteStar.name = `whiteStar${i}`;
            whiteStar.position.set(
                (Math.random() - 0.5) * (boundsX * 2),
                (Math.random() - 0.5) * (boundsY * 2) + centerY,
                (Math.random() - 0.5) * (boundsZ * 2)
            );

            scene.add(whiteStar);
            whiteStars.push(whiteStar);
            whiteStarVelocities.push(
                new THREE.Vector3(
                    (Math.random() - 0.5) * speed,
                    (Math.random() - 0.5) * speed,
                    (Math.random() - 0.5) * speed
                )
            );
        }

        const Na__GenerateObject__UpdateAnimatedWhiteStars = () => {
            for (let i = 0; i < count; i++) {
                const whiteStar = whiteStars[i];
                const whiteStarVelocity = whiteStarVelocities[i];

                whiteStar.position.add(whiteStarVelocity);

                if (Math.abs(whiteStar.position.x) > boundsX) whiteStarVelocity.x *= -1;
                if (Math.abs(whiteStar.position.y - centerY) > boundsY) whiteStarVelocity.y *= -1;
                if (Math.abs(whiteStar.position.z) > boundsZ) whiteStarVelocity.z *= -1;
            }
        };

        if (typeof options.registerUpdate === 'function') {
            options.registerUpdate(Na__GenerateObject__UpdateAnimatedWhiteStars);
        }

        const Na__GenerateObject__DisposeAnimatedWhiteStars = () => {
            whiteStars.forEach((mesh) => {
                scene.remove(mesh);
                if (mesh.material) mesh.material.dispose();
            });
            sphereGeometry.dispose();
        };

        return {
            meshes: whiteStars,
            velocities: whiteStarVelocities,
            update: Na__GenerateObject__UpdateAnimatedWhiteStars,
            dispose: Na__GenerateObject__DisposeAnimatedWhiteStars
        };
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------

