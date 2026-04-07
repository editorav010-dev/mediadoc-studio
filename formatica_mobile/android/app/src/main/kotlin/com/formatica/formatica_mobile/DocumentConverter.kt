package com.formatica.formatica_mobile

import android.graphics.pdf.PdfDocument
import android.graphics.Bitmap
import android.graphics.Color
import android.graphics.Paint
import android.graphics.Typeface
import android.text.StaticLayout
import android.text.TextPaint
import android.text.Layout
import org.apache.poi.ss.usermodel.*
import org.apache.poi.xssf.usermodel.XSSFWorkbook
import org.apache.poi.hssf.usermodel.HSSFWorkbook
import org.apache.poi.xslf.usermodel.XMLSlideShow
import org.apache.poi.hslf.usermodel.HSLFSlideShow
import org.apache.poi.ss.util.CellRangeAddress
import java.io.File
import java.io.FileInputStream
import java.io.FileOutputStream
import java.io.InputStream

/**
 * Native document converter using Apache POI for Office formats.
 * Converts XLSX, XLS, PPTX, PPT, and CSV to PDF.
 */
class DocumentConverter {
    
    companion object {
        private const val A4_WIDTH = 595
        private const val A4_HEIGHT = 842
        private const val MARGIN = 40
    }

    /**
     * Convert spreadsheet (XLSX/XLS/CSV) to PDF
     */
    fun convertSpreadsheetToPdf(
        inputPath: String,
        outputPath: String,
        format: String
    ): Result<String> {
        return try {
            val inputFile = File(inputPath)
            if (!inputFile.exists()) {
                return Result.failure(Exception("Input file not found: $inputPath"))
            }

            val workbook: Workbook = when (format.lowercase()) {
                "xlsx" -> XSSFWorkbook(FileInputStream(inputFile))
                "xls" -> HSSFWorkbook(FileInputStream(inputFile))
                "csv" -> createWorkbookFromCsv(inputFile)
                else -> return Result.failure(Exception("Unsupported format: $format"))
            }

            val pdfDocument = PdfDocument()
            var pageNumber = 1

            // Convert each sheet to PDF pages
            for (sheetIndex in 0 until workbook.numberOfSheets) {
                val sheet = workbook.getSheetAt(sheetIndex)
                val sheetPages = convertSheetToPages(sheet, pageNumber)
                
                for (pageData in sheetPages) {
                    val pageInfo = PdfDocument.PageInfo.Builder(A4_WIDTH, A4_HEIGHT, pageNumber)
                        .create()
                    val page = pdfDocument.startPage(pageInfo)
                    
                    page.canvas.drawBitmap(pageData.bitmap, 0f, 0f, null)
                    pdfDocument.finishPage(page)
                    pageNumber++
                }
            }

            // Write PDF to output file
            val outputFile = File(outputPath)
            outputFile.parentFile?.mkdirs()
            
            FileOutputStream(outputFile).use { outputStream ->
                pdfDocument.writeTo(outputStream)
            }
            
            pdfDocument.close()
            workbook.close()

            Result.success(outputPath)
        } catch (e: Exception) {
            Result.failure(Exception("Spreadsheet conversion failed: ${e.message}", e))
        }
    }

    /**
     * Convert presentation (PPTX/PPT) to PDF
     */
    fun convertPresentationToPdf(
        inputPath: String,
        outputPath: String,
        format: String
    ): Result<String> {
        return try {
            val inputFile = File(inputPath)
            if (!inputFile.exists()) {
                return Result.failure(Exception("Input file not found: $inputPath"))
            }

            val pdfDocument = PdfDocument()
            var pageNumber = 1

            when (format.lowercase()) {
                "pptx" -> {
                    val slideShow = XMLSlideShow(FileInputStream(inputFile))
                    for (slide in slideShow.slides) {
                        val pageData = convertSlideToPage(slide, pageNumber)
                        val pageInfo = PdfDocument.PageInfo.Builder(A4_WIDTH, A4_HEIGHT, pageNumber)
                            .create()
                        val page = pdfDocument.startPage(pageInfo)
                        page.canvas.drawBitmap(pageData.bitmap, 0f, 0f, null)
                        pdfDocument.finishPage(page)
                        pageNumber++
                    }
                    slideShow.close()
                }
                "ppt" -> {
                    val slideShow = HSLFSlideShow(FileInputStream(inputFile))
                    for (slide in slideShow.slides) {
                        val pageData = convertHSLFSlideToPage(slide, pageNumber)
                        val pageInfo = PdfDocument.PageInfo.Builder(A4_WIDTH, A4_HEIGHT, pageNumber)
                            .create()
                        val page = pdfDocument.startPage(pageInfo)
                        page.canvas.drawBitmap(pageData.bitmap, 0f, 0f, null)
                        pdfDocument.finishPage(page)
                        pageNumber++
                    }
                    slideShow.close()
                }
                else -> return Result.failure(Exception("Unsupported format: $format"))
            }

            // Write PDF to output file
            val outputFile = File(outputPath)
            outputFile.parentFile?.mkdirs()
            
            FileOutputStream(outputFile).use { outputStream ->
                pdfDocument.writeTo(outputStream)
            }
            
            pdfDocument.close()

            Result.success(outputPath)
        } catch (e: Exception) {
            Result.failure(Exception("Presentation conversion failed: ${e.message}", e))
        }
    }

    // ========== PRIVATE HELPER METHODS ==========

    private fun convertSheetToPages(sheet: Sheet, startPage: Int): List<PageData> {
        val pages = mutableListOf<PageData>()
        val paint = TextPaint().apply {
            textSize = 10f
            color = Color.BLACK
            typeface = Typeface.DEFAULT
        }

        val bitmap = Bitmap.createBitmap(A4_WIDTH, A4_HEIGHT, Bitmap.Config.ARGB_8888)
        val canvas = android.graphics.Canvas(bitmap)
        canvas.drawColor(Color.WHITE)

        var yPosition = MARGIN
        var currentPage = 1

        // Draw sheet title
        val titlePaint = Paint().apply {
            textSize = 14f
            color = Color.BLACK
            isAntiAlias = true
            typeface = Typeface.DEFAULT_BOLD
        }
        canvas.drawText("Sheet: ${sheet.sheetName}", MARGIN.toFloat(), yPosition, titlePaint)
        yPosition += 25

        // Draw column headers and data
        val headerPaint = Paint().apply {
            textSize = 9f
            color = Color.WHITE
            isAntiAlias = true
            typeface = Typeface.DEFAULT_BOLD
        }

        val cellPaint = Paint().apply {
            textSize = 8f
            color = Color.BLACK
            isAntiAlias = true
        }

        // Get max rows and columns
        val maxRow = sheet.lastRowNum
        var maxCol = 0
        for (rowIndex in 0..maxRow) {
            val row = sheet.getRow(rowIndex)
            if (row != null && row.lastCellNum > maxCol) {
                maxCol = row.lastCellNum.toInt()
            }
        }

        val colWidth = (A4_WIDTH - 2 * MARGIN) / max(1, maxCol)
        val rowHeight = 18

        // Draw headers
        var xPosition = MARGIN
        val headerBgPaint = Paint().apply {
            color = Color.rgb(66, 133, 244) // Google Blue
            style = Paint.Style.FILL
        }
        canvas.drawRect(MARGIN.toFloat(), (yPosition - 12).toFloat(), 
            (A4_WIDTH - MARGIN).toFloat(), (yPosition + 4).toFloat(), headerBgPaint)
        
        for (colIndex in 0 until maxCol) {
            val headerText = getColumnLetter(colIndex)
            canvas.drawText(headerText, xPosition.toFloat(), yPosition.toFloat(), headerPaint)
            xPosition += colWidth
        }
        yPosition += 20

        // Draw data rows
        for (rowIndex in 0..maxRow) {
            val row = sheet.getRow(rowIndex)
            if (row == null) continue

            // Check if we need a new page
            if (yPosition + rowHeight > A4_HEIGHT - MARGIN) {
                pages.add(PageData(bitmap.copy(Bitmap.Config.ARGB_8888, true), currentPage))
                currentPage++
                
                // Reset for new page
                bitmap.eraseColor(Color.WHITE)
                yPosition = MARGIN
            }

            xPosition = MARGIN
            for (colIndex in 0 until maxCol) {
                val cell = row.getCell(colIndex)
                val cellValue = getCellValue(cell)
                
                // Alternate row colors
                if (rowIndex % 2 == 0) {
                    val bgPaint = Paint().apply {
                        color = Color.rgb(245, 245, 245)
                        style = Paint.Style.FILL
                    }
                    canvas.drawRect(xPosition.toFloat(), (yPosition - 10).toFloat(),
                        (xPosition + colWidth).toFloat(), (yPosition + 6).toFloat(), bgPaint)
                }

                canvas.drawText(cellValue, xPosition.toFloat(), yPosition.toFloat(), cellPaint)
                xPosition += colWidth
            }
            yPosition += rowHeight
        }

        // Add last page
        pages.add(PageData(bitmap.copy(Bitmap.Config.ARGB_8888, true), currentPage))

        return pages
    }

    private fun convertSlideToPage(slide: org.apache.poi.xslf.usermodel.XSLFSlide, pageNum: Int): PageData {
        val bitmap = Bitmap.createBitmap(A4_WIDTH, A4_HEIGHT, Bitmap.Config.ARGB_8888)
        val canvas = android.graphics.Canvas(bitmap)
        canvas.drawColor(Color.WHITE)

        val paint = TextPaint().apply {
            textSize = 12f
            color = Color.BLACK
            isAntiAlias = true
        }

        var yPosition = MARGIN + 20
        
        // Extract text from slide shapes
        for (shape in slide.shapes) {
            if (shape is org.apache.poi.xslf.usermodel.XSLFTextShape) {
                for (paragraph in shape.textParagraphs) {
                    val text = paragraph.text?.trim()
                    if (!text.isNullOrEmpty()) {
                        val layout = StaticLayout.Builder.obtain(text, 0, text.length, paint, A4_WIDTH - 2 * MARGIN)
                            .setAlignment(Layout.Alignment.ALIGN_NORMAL)
                            .setLineSpacing(4f, 1f)
                            .setIncludePad(false)
                            .build()
                        
                        canvas.save()
                        canvas.translate(MARGIN.toFloat(), yPosition.toFloat())
                        layout.draw(canvas)
                        canvas.restore()
                        
                        yPosition += layout.height + 10
                    }
                }
            }
        }

        return PageData(bitmap, pageNum)
    }

    private fun convertHSLFSlideToPage(slide: org.apache.poi.hslf.usermodel.HSLFSlide, pageNum: Int): PageData {
        val bitmap = Bitmap.createBitmap(A4_WIDTH, A4_HEIGHT, Bitmap.Config.ARGB_8888)
        val canvas = android.graphics.Canvas(bitmap)
        canvas.drawColor(Color.WHITE)

        val paint = TextPaint().apply {
            textSize = 12f
            color = Color.BLACK
            isAntiAlias = true
        }

        var yPosition = MARGIN + 20
        
        // Extract text from slide shapes
        for (shape in slide.shapes) {
            if (shape is org.apache.poi.hslf.usermodel.HSLFTextShape) {
                for (paragraph in shape.textParagraphs) {
                    val text = paragraph.text?.trim()
                    if (!text.isNullOrEmpty()) {
                        val layout = StaticLayout.Builder.obtain(text, 0, text.length, paint, A4_WIDTH - 2 * MARGIN)
                            .setAlignment(Layout.Alignment.ALIGN_NORMAL)
                            .setLineSpacing(4f, 1f)
                            .setIncludePad(false)
                            .build()
                        
                        canvas.save()
                        canvas.translate(MARGIN.toFloat(), yPosition.toFloat())
                        layout.draw(canvas)
                        canvas.restore()
                        
                        yPosition += layout.height + 10
                    }
                }
            }
        }

        return PageData(bitmap, pageNum)
    }

    private fun createWorkbookFromCsv(csvFile: File): Workbook {
        val workbook = XSSFWorkbook()
        val sheet = workbook.createSheet("CSV Data")

        csvFile.bufferedReader().useLines { lines ->
            var rowIndex = 0
            lines.forEach { line ->
                val row = sheet.createRow(rowIndex++)
                val columns = line.split(",")
                columns.forEachIndexed { colIndex, value ->
                    val cell = row.createCell(colIndex)
                    cell.setCellValue(value.trim().removeSurrounding("\""))
                }
            }
        }

        return workbook
    }

    private fun getCellValue(cell: Cell?): String {
        if (cell == null) return ""
        
        return when (cell.cellType) {
            CellType.STRING -> cell.stringCellValue
            CellType.NUMERIC -> {
                if (DateUtil.isCellDateFormatted(cell)) {
                    cell.dateCellValue.toString()
                } else {
                    val numVal = cell.numericCellValue
                    if (numVal == numVal.toLong().toDouble()) {
                        numVal.toLong().toString()
                    } else {
                        String.format("%.2f", numVal)
                    }
                }
            }
            CellType.BOOLEAN -> cell.booleanCellValue.toString()
            CellType.FORMULA -> cell.cellFormula
            else -> ""
        }
    }

    private fun getColumnLetter(index: Int): String {
        var result = ""
        var idx = index
        while (idx >= 0) {
            result = ((idx % 26) + 65).toChar().toString() + result
            idx = (idx / 26) - 1
        }
        return result
    }

    data class PageData(val bitmap: Bitmap, val pageNumber: Int)
}
