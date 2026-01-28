/**
 * Script to manually trigger analytics computation
 * 
 * Usage:
 *   node scripts/compute-analytics.js
 *   node scripts/compute-analytics.js --weeks 2024-W01,2024-W02
 *   node scripts/compute-analytics.js --all
 */

const BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000'

async function computeAnalytics(options = {}) {
  try {
    console.log('Starting analytics computation...')
    
    const response = await fetch(`${BASE_URL}/api/analytics/compute`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(options),
    })

    const data = await response.json()

    if (data.success) {
      console.log('✅ Analytics computed successfully!')
      console.log('\nResults:')
      console.log(JSON.stringify(data.results, null, 2))
      console.log(`\nProcessed ${data.processed_documents || 0} documents`)
    } else {
      console.error('❌ Error:', data.error)
      process.exit(1)
    }
  } catch (error) {
    console.error('❌ Failed to compute analytics:', error.message)
    process.exit(1)
  }
}

// Parse command line arguments
const args = process.argv.slice(2)
const options = {}

if (args.includes('--all')) {
  options.reprocessAll = true
} else {
  const weeksIndex = args.indexOf('--weeks')
  if (weeksIndex !== -1 && args[weeksIndex + 1]) {
    options.weeks = args[weeksIndex + 1].split(',')
  }
}

computeAnalytics(options)
