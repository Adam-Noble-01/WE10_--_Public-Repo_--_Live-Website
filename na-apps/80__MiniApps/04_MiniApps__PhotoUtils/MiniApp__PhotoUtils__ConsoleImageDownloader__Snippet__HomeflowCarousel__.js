(async () => {
    const property = Homeflow.get('property');
    const photos = property.photos;

    console.log(`Found ${photos.length} carousel images.`);

    const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

    for (let i = 0; i < photos.length; i++) {

        // Exact URL stored in the carousel data
        let url = photos[i].url;

        // Convert //mr1... into https://mr1...
        if (url.startsWith('//')) {
            url = 'https:' + url;
        }

        // Request a large 1920px version
        url = url.replace('/_x_/', '/1920x_/');

        const originalName = url.split('/').pop().split('?')[0];
        const filename =
            String(i + 1).padStart(2, '0') +
            '__' +
            originalName;

        console.log(
            `[${i + 1}/${photos.length}] ${filename}`
        );

        try {
            const response = await fetch(url);

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }

            const blob = await response.blob();
            const blobURL = URL.createObjectURL(blob);

            const a = document.createElement('a');
            a.href = blobURL;
            a.download = filename;

            document.body.appendChild(a);
            a.click();
            a.remove();

            setTimeout(() => URL.revokeObjectURL(blobURL), 5000);

        } catch (error) {
            console.error(
                `FAILED: ${filename}`,
                error
            );
        }

        // Prevent Chrome blocking/overloading downloads
        await sleep(400);
    }

    console.log(`DONE — attempted all ${photos.length} carousel images.`);
})();
