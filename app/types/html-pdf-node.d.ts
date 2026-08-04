declare module 'html-pdf-node' {
  export interface Margin {
    top?: string
    right?: string
    bottom?: string
    left?: string
  }

  export interface PdfOptions {
    format?: string
    landscape?: boolean
    margin?: Margin
    printBackground?: boolean
    args?: string[]
    path?: string
    scale?: number
    width?: string
    height?: string
    preferCSSPageSize?: boolean
  }

  export interface File {
    content?: string
    url?: string
  }

  export function generatePdf(file: File, options: PdfOptions): Promise<Buffer>
}
