import dotenv from "dotenv";
dotenv.config();

async function test() {
  const { groqExtractionProvider } = await import("./src/modules/extraction/groqExtractionProvider");
  
  console.log("Testing Groq OCR extraction...");
  
  // A tiny 10x10 black PNG
  const base64Image = "iVBORw0KGgoAAAANSUhEUgAAAAoAAAAKCAYAAACNMs+9AAAAF0lEQVQYGWP8//8/AwMDAwMDAwMDAwMDAwMDABg7AAXczeYnAAAAAElFTkSuQmCC";
  const buffer = Buffer.from(base64Image, "base64");

  try {
    const result = await groqExtractionProvider.extractInvoice({
      documentBuffer: buffer,
      mimeType: "image/png",
      filename: "test-invoice.png"
    });
    
    console.log("Successfully received JSON response from Groq!");
    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    console.error("Test failed:");
    console.error(error);
  }
}

test();
