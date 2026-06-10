from pathlib import Path

FILE = Path("app/scan-item.tsx")
content = FILE.read_text()

# 1. Add AR overlay state after scan lock
needle = 'const [isScanning, setIsScanning] = useState(false);'
insert = 'const [isScanning, setIsScanning] = useState(false);\n  const [arOverlay, setArOverlay] = useState<any>(null);'

if "arOverlay" not in content:
    content = content.replace(needle, insert)

# 2. Replace AI scan-result navigation with overlay data
ai_old = '''router.replace({
        pathname: "/scan-result",
        params: {
          code: "AI_IMAGE_SCAN",
          found: String(!!result?.found),
          suggestedName: result?.title ?? "",
          source: "AWS Rekognition",
          brand: result?.brand ?? "",
          image: photo.uri ?? "",
          description: result?.description ?? "",
          matchConfidence:
            result?.confidence != null ? String(result.confidence) : "",
          matchStatus: result?.found ? "possible" : "unknown",
        },
      });'''

ai_new = '''setArOverlay({
        type: "ai",
        code: "AI_IMAGE_SCAN",
        found: !!result?.found,
        suggestedName: result?.title ?? "",
        source: "AWS Rekognition",
        brand: result?.brand ?? "",
        image: photo.uri ?? "",
        description: result?.description ?? "",
        matchConfidence: result?.confidence != null ? String(result.confidence) : "",
        matchStatus: result?.found ? "possible" : "unknown",
      });'''

content = content.replace(ai_old, ai_new)

# 3. Replace generic barcode scan-result navigation with overlay data
barcode_old = '''router.replace({
            pathname: "/scan-result",
            params: {
              code: result.barcode,
              found: String(result.found),
              suggestedName: result.bestName ?? "",
              source: result.sources.upcitemdb ? "UPCitemDB" : result.sources.openFoodFacts ? "OpenFoodFacts" : "Unknown",
              brand: result.sources.upcitemdb?.brand ?? "",
              image: result.sources.upcitemdb?.image ?? "",
              description: result.sources.upcitemdb?.description ?? "",
              matchConfidence: result.sources.upcitemdb?.confidence != null ? String(result.sources.upcitemdb.confidence) : "",
              matchStatus: result.found ? "found" : "unknown",
            },
          });'''

barcode_new = '''setArOverlay({
            type: "barcode",
            code: result.barcode,
            found: result.found,
            suggestedName: result.bestName ?? "",
            source: result.sources.upcitemdb ? "UPCitemDB" : result.sources.openFoodFacts ? "OpenFoodFacts" : "Unknown",
            brand: result.sources.upcitemdb?.brand ?? "",
            image: result.sources.upcitemdb?.image ?? "",
            description: result.sources.upcitemdb?.description ?? "",
            matchConfidence: result.sources.upcitemdb?.confidence != null ? String(result.sources.upcitemdb.confidence) : "",
            matchStatus: result.found ? "found" : "unknown",
          });'''

content = content.replace(barcode_old, barcode_new)

FILE.write_text(content)
print("AR Phase 1 real patch applied")
