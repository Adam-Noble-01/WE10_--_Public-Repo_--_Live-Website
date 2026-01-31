fetch("https://www.noble-architecture.com/assets/AD01_-_DATA_-_Common_-_Global-Data-Library/AD01_10_-_DATA_-_Common_-_Core-Web-Asset-Library.json")
    .then(r => r.json())
    .then(data => {
        const meta = data["File_Metadata"];
        for (const key in meta) {
            console.log(`KEY = ${key}  →  VALUE = "${meta[key]}"`); 
        }
    });
