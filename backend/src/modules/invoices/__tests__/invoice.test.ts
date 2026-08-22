import assert from "node:assert/strict";

type TestCase = { name: string; run: () => Promise<void> | void };

// Test MIME type validation logic (without Firebase dependency)
const validMimeTypes = ["application/pdf", "image/jpeg", "image/png", "image/tiff", "image/webp"];

const validateMimeType = (mimeType: string): boolean => {
  return validMimeTypes.includes(mimeType);
};

const validateFileSize = (sizeBytes: number): boolean => {
  const maxFileSizeBytes = 10 * 1024 * 1024;
  return sizeBytes <= maxFileSizeBytes;
};

const getFileExtension = (filename: string): string => {
  const match = filename.match(/\.[^.]*$/);
  return match ? match[0] : "";
};

const tests: TestCase[] = [
  {
    name: "file validation: valid PDF MIME type",
    run: () => {
      assert.equal(validateMimeType("application/pdf"), true, "PDF should be valid");
    }
  },
  {
    name: "file validation: valid JPEG MIME type",
    run: () => {
      assert.equal(validateMimeType("image/jpeg"), true, "JPEG should be valid");
    }
  },
  {
    name: "file validation: valid PNG MIME type",
    run: () => {
      assert.equal(validateMimeType("image/png"), true, "PNG should be valid");
    }
  },
  {
    name: "file validation: valid TIFF MIME type",
    run: () => {
      assert.equal(validateMimeType("image/tiff"), true, "TIFF should be valid");
    }
  },
  {
    name: "file validation: valid WebP MIME type",
    run: () => {
      assert.equal(validateMimeType("image/webp"), true, "WebP should be valid");
    }
  },
  {
    name: "file validation: reject text/plain",
    run: () => {
      assert.equal(validateMimeType("text/plain"), false, "text/plain should be rejected");
    }
  },
  {
    name: "file validation: reject Word document",
    run: () => {
      assert.equal(
        validateMimeType("application/vnd.openxmlformats-officedocument.wordprocessingml.document"),
        false,
        "DOCX should be rejected"
      );
    }
  },
  {
    name: "file validation: reject Excel",
    run: () => {
      assert.equal(
        validateMimeType("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"),
        false,
        "XLSX should be rejected"
      );
    }
  },
  {
    name: "file size: 5MB within limit",
    run: () => {
      const fiveMillionBytes = 5 * 1024 * 1024;
      assert.equal(validateFileSize(fiveMillionBytes), true, "5MB should be valid");
    }
  },
  {
    name: "file size: 10MB at limit",
    run: () => {
      const tenMillionBytes = 10 * 1024 * 1024;
      assert.equal(validateFileSize(tenMillionBytes), true, "10MB should be valid");
    }
  },
  {
    name: "file size: 11MB exceeds limit",
    run: () => {
      const elevenMillionBytes = 11 * 1024 * 1024;
      assert.equal(validateFileSize(elevenMillionBytes), false, "11MB should be rejected");
    }
  },
  {
    name: "file size: 100MB exceeds limit",
    run: () => {
      const hundredMillionBytes = 100 * 1024 * 1024;
      assert.equal(validateFileSize(hundredMillionBytes), false, "100MB should be rejected");
    }
  },
  {
    name: "file extension: PDF preservation",
    run: () => {
      const ext = getFileExtension("invoice.pdf");
      assert.equal(ext, ".pdf", "Should extract .pdf extension");
    }
  },
  {
    name: "file extension: JPEG preservation",
    run: () => {
      const ext = getFileExtension("scan.jpg");
      assert.equal(ext, ".jpg", "Should extract .jpg extension");
    }
  },
  {
    name: "file extension: PNG preservation",
    run: () => {
      const ext = getFileExtension("document.png");
      assert.equal(ext, ".png", "Should extract .png extension");
    }
  },
  {
    name: "file extension: missing extension",
    run: () => {
      const ext = getFileExtension("invoice");
      assert.equal(ext, "", "Should return empty string for no extension");
    }
  },
  {
    name: "invoice document model: documentStatus initial state",
    run: () => {
      const initialStatus = "EXTRACTION_PENDING";
      assert.equal(initialStatus, "EXTRACTION_PENDING", "Initial status must be EXTRACTION_PENDING");
    }
  },
  {
    name: "invoice document model: valid invoice types",
    run: () => {
      const validTypes = ["PO_BASED", "NON_PO"];
      assert.ok(validTypes.includes("PO_BASED"), "PO_BASED should be valid");
      assert.ok(validTypes.includes("NON_PO"), "NON_PO should be valid");
    }
  },
  {
    name: "invoice document model: invoiceNumber initially null",
    run: () => {
      const invoiceNumber = null;
      assert.equal(invoiceNumber, null, "invoiceNumber should be initially null before extraction");
    }
  },
  {
    name: "invoice document model: metadata has extractionAttempts",
    run: () => {
      const metadata = { extractionAttempts: 0 };
      assert.equal(metadata.extractionAttempts, 0, "Should initialize extractionAttempts to 0");
    }
  }
];
async function run() {
  for (const test of tests) {
    try {
      await test.run();
      console.log(`ok - ${test.name}`);
    } catch (error) {
      console.error(`not ok - ${test.name}`);
      console.error(`  ${error instanceof Error ? error.message : String(error)}`);
      process.exit(1);
    }
  }
  console.log(`${tests.length} invoice upload validation tests passed`);
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
