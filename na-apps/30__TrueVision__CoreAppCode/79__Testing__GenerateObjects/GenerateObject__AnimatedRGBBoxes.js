import * as THREE from 'three';

// -----------------------------------------------------------------------------
// REGION | Generate Objects - Animated RGB Boxes
// -----------------------------------------------------------------------------

    // FUNCTION | Create Animated RGB Boxes
    // ------------------------------------------------------------
    export function Na__GenerateObject__CreateAnimatedRGBBoxes(scene, options = {}) {
        const count = Number.isFinite(options.count) ? options.count : 500;
        const size = Number.isFinite(options.size) ? options.size : 0.2;
        const boundsX = Number.isFinite(options.boundsX) ? options.boundsX : 5;
        const boundsY = Number.isFinite(options.boundsY) ? options.boundsY : 3;
        const boundsZ = Number.isFinite(options.boundsZ) ? options.boundsZ : 5;
        const centerY = Number.isFinite(options.centerY) ? options.centerY : 1;
        const speed = Number.isFinite(options.speed) ? options.speed : 0.05;

        const boxGeometry = new THREE.BoxGeometry(size, size, size);
        const rgbBoxes = [];
        const rgbBoxVelocities = [];
        const rgbBoxColours = [
            new THREE.Color(1, 0, 0),
            new THREE.Color(0, 1, 0),
            new THREE.Color(0, 0, 1)
        ];

        for (let i = 0; i < count; i++) {
            const colour = rgbBoxColours[i % 3];
            const rgbBoxMaterial = new THREE.MeshStandardMaterial({
                color: colour,
                emissive: colour
            });

            const rgbBox = new THREE.Mesh(boxGeometry, rgbBoxMaterial);
            rgbBox.name = `rgbBox${i}`;
            rgbBox.position.set(
                (Math.random() - 0.5) * (boundsX * 2),
                (Math.random() - 0.5) * (boundsY * 2) + centerY,
                (Math.random() - 0.5) * (boundsZ * 2)
            );

            scene.add(rgbBox);
            rgbBoxes.push(rgbBox);
            rgbBoxVelocities.push(
                new THREE.Vector3(
                    (Math.random() - 0.5) * speed,
                    (Math.random() - 0.5) * speed,
                    (Math.random() - 0.5) * speed
                )
            );
        }

        const Na__GenerateObject__UpdateAnimatedRGBBoxes = () => {
            for (let i = 0; i < count; i++) {
                const rgbBox = rgbBoxes[i];
                const rgbBoxVelocity = rgbBoxVelocities[i];

                rgbBox.position.add(rgbBoxVelocity);

                if (Math.abs(rgbBox.position.x) > boundsX) rgbBoxVelocity.x *= -1;
                if (Math.abs(rgbBox.position.y - centerY) > boundsY) rgbBoxVelocity.y *= -1;
                if (Math.abs(rgbBox.position.z) > boundsZ) rgbBoxVelocity.z *= -1;
            }
        };

        if (typeof options.registerUpdate === 'function') {
            options.registerUpdate(Na__GenerateObject__UpdateAnimatedRGBBoxes);
        }

        const Na__GenerateObject__DisposeAnimatedRGBBoxes = () => {
            rgbBoxes.forEach((mesh) => {
                scene.remove(mesh);
                if (mesh.material) mesh.material.dispose();
            });
            boxGeometry.dispose();
        };

        return {
            meshes: rgbBoxes,
            velocities: rgbBoxVelocities,
            update: Na__GenerateObject__UpdateAnimatedRGBBoxes,
            dispose: Na__GenerateObject__DisposeAnimatedRGBBoxes
        };
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------

