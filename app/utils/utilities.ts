// Helper: French number formatting with no decimals, no currency name
export function formatCurrency(amount: number | null | undefined): string {
    const num = Number(amount)
    if (!isFinite(num)) {
        return '0'
    }
    return num.toLocaleString('fr-FR', {
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
    })
}