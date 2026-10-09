import Foundation
import PDFKit
import Vision
import AppKit

let input = CommandLine.arguments[1]
let output = URL(fileURLWithPath: CommandLine.arguments[2])
let doc = PDFDocument(url: URL(fileURLWithPath: input))!
try FileManager.default.createDirectory(at: output, withIntermediateDirectories: true)
for index in 0..<doc.pageCount {
    let destination = output.appendingPathComponent(String(format: "%03d.json", index + 1))
    if FileManager.default.fileExists(atPath: destination.path) { continue }
    autoreleasepool {
        let page = doc.page(at: index)!
        let bounds = page.bounds(for: .mediaBox)
        let size = NSSize(width: bounds.width * 2, height: bounds.height * 2)
        let image = page.thumbnail(of: size, for: .mediaBox)
        var rect = CGRect(origin: .zero, size: image.size)
        let cg = image.cgImage(forProposedRect: &rect, context: nil, hints: nil)!
        let request = VNRecognizeTextRequest()
        request.recognitionLevel = .accurate
        request.recognitionLanguages = ["zh-Hans", "vi-VN", "en-US"]
        request.usesLanguageCorrection = false
        do {
            try VNImageRequestHandler(cgImage: cg).perform([request])
            let rows: [[String: Any]] = (request.results ?? []).compactMap { observation in
                guard let candidate = observation.topCandidates(1).first else { return nil }
                let b = observation.boundingBox
                return ["text": candidate.string, "confidence": candidate.confidence,
                        "box": [b.minX, 1-b.maxY, b.width, b.height]]
            }
            let object: [String: Any] = ["page": index + 1, "width": cg.width, "height": cg.height, "rows": rows]
            try JSONSerialization.data(withJSONObject: object, options: [.prettyPrinted, .sortedKeys]).write(to: destination)
            let bitmap = NSBitmapImageRep(cgImage: cg)
            try bitmap.representation(using: .png, properties: [:])!.write(to: output.appendingPathComponent(String(format: "%03d.png", index+1)))
            print("Page \(index+1)/\(doc.pageCount)")
        } catch { fatalError("OCR failed: \(error)") }
    }
}
