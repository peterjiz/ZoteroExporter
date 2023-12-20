async function exportSelectedItems() {
    var ZoteroPane = Zotero.getActiveZoteroPane();
    var selectedItems = ZoteroPane.getSelectedItems();

    // Ensure that some items are selected
    if (!selectedItems.length) {
        Zotero.alert(null, "No items selected", "Please select some items to export.");
        return;
    }
    var exportFormatGUID = '32d59d2d-b65a-4da4-b0a3-bdd3cfb979e7'

    // Prompt the user to select a folder
    var nsIFilePicker = Components.interfaces.nsIFilePicker;
    var fp = Components.classes["@mozilla.org/filepicker;1"].createInstance(nsIFilePicker);
    // fp.init(window, "Export", nsIFilePicker.modeGetFolder);
    fp.init(window, "Export", nsIFilePicker.modeSave);
    fp.defaultString = "Exported Items";


    let result = await new Promise(resolve => fp.open(resolve));
    if (result != nsIFilePicker.returnOK && result != nsIFilePicker.returnReplace) {
        return;
    }

    var folder = fp.file;
    // var folderPath = folder.path + "/Exported Items/"; // Replace with your desired file name and extension
    var folderPath = folder.path + "/"
    var zoteroExportFolderPath = Zotero.File.pathToFile(folderPath)
    if (zoteroExportFolderPath.exists()) {
        try {
            // Zotero.alert(null, "Trying to delete folder");
            await zoteroExportFolderPath.remove(true);
        } catch (e) {
            Zotero.alert(null, "Error", `Failed to delete file: ${entry.path} - ${e.message}`);
        }
    }
    zoteroExportFolderPath.create(Components.interfaces.nsIFile.DIRECTORY_TYPE, 0o755);

    var filePath = folderPath + "Exported Items.ris"; // Replace with your desired file name and extension
    var zoteroFile = Zotero.File.pathToFile(filePath);
    zoteroFile.createUnique(Components.interfaces.nsIFile.NORMAL_FILE_TYPE, 0o666);

    var pdfFolderPathL1 = "files/";
    var pdfFolderPath = folderPath + "files/";
    var zoteroPdfFolderPath = Zotero.File.pathToFile(pdfFolderPath)
    if (!zoteroPdfFolderPath.exists()) {
        zoteroPdfFolderPath.create(Components.interfaces.nsIFile.DIRECTORY_TYPE, 0o755);
    }

    try {

        let pdfPaths = [];
        for (let item of selectedItems) {
            if (item.isRegularItem()) {
                let attachments = await item.getAttachments();
                for (let attachmentID of attachments) {
                    let attachment = Zotero.Items.get(attachmentID);
                    if (attachment.attachmentContentType === "application/pdf") {
                        let attachmentFilepath = attachment.getFilePath();
                        let zoteroAttachmentFilepath = Zotero.File.pathToFile(attachmentFilepath);

                        var zoteroSinglePdfFolderPath = Zotero.File.pathToFile(`${pdfFolderPath}${attachmentID}/`)
                        if (!zoteroSinglePdfFolderPath.exists()) {
                            zoteroSinglePdfFolderPath.create(Components.interfaces.nsIFile.DIRECTORY_TYPE, 0o755);
                        }

                        zoteroAttachmentFilepath.copyToFollowingLinks(zoteroSinglePdfFolderPath, zoteroAttachmentFilepath.leafName);

                        // pdfPaths.push(`${pdfFolderPath}${zoteroAttachmentFilepath.leafName}`);
                        pdfPaths.unshift(`${pdfFolderPathL1}${attachmentID}/${zoteroAttachmentFilepath.leafName}`);

                        break;

                    }
                }
            }
        }

        var translator = new Zotero.Translate.Export();
        translator.setTranslator(exportFormatGUID);
        translator.setItems(selectedItems);
        translator.setLocation(zoteroFile);

        await translator.translate();


        // Zotero.alert(null, `pdfPaths[0]: ${pdfPaths[0]}`);
        // Zotero.alert(null, `pdfPaths[1]: ${pdfPaths[1]}`);


        // Read the RIS file, modify it, and write it back
        let risContent = await Zotero.File.getContentsAsync(filePath);
        let risRecords = risContent.split('ER  -');
        risRecords = risRecords.slice(0, risRecords.length-1);
        let updatedRisContent = '';

        // Iterate over both RIS records and pdfPaths simultaneously
        for (let [index, record] of risRecords.entries()) {
            // Zotero.alert(null, "HERE1");
            if (!record.trim()) continue; // Skip empty records

            let lines = record.split('\n');

            let pdfPath = pdfPaths[index]; // Corresponding PDF path
            // Zotero.alert(null, `pdfPath: ${pdfPath}`);

            // Find the index of the ER field
            let erIndex = lines.findIndex(line => line.startsWith("ER  - "));
            if (erIndex === -1) {
                erIndex = lines.length-1; // If ER is not found, append at the end
            }

            // Zotero.alert(null, "HERE3");
            // Find and update the L1 field, or add it if not found
            let l1Index = lines.findIndex(line => line.startsWith("L1  - "));

            // l1Index = -1

            if (l1Index !== -1) {
                lines[l1Index] = "L1  - " + pdfPath;
            } else {
                // Add the L1 field before the last line (ER  - )
                // lines.splice(lines.length - 1, 0, "L1  - " + pdfPath);
                // lines.splice(erIndex, 0, "L1  - " + pdfPath);

                // Insert the L1 line before the ER field
                // This includes all lines up to the ER line, inserts the L1 line, then includes the rest
                lines = [...lines.slice(0, erIndex), "L1  - " + pdfPath, ...lines.slice(erIndex)];

                // Zotero.alert(null, "HERE4B");
            }

            updatedRisContent += lines.join('\n') + 'ER  - \n'; // Reassemble the record
        }

        Zotero.File.putContents(zoteroFile, updatedRisContent.trim());

        // Zotero.alert(null, "Export Complete", "Selected items have been exported.");
    } catch (e) {
        // Zotero.alert(null, "Error", `An error occurred: ${e.message}`);
    }
}

// exportSelectedItems();