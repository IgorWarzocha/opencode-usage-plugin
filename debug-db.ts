import { UsageStorage } from "./storage"
import { join } from "path"

const dbPath = join(process.cwd(), ".opencode/plugin/usage/usage.sqlite")
console.log("Checking DB at:", dbPath)

try {
  const storage = new UsageStorage(dbPath)

  const count = (storage as any).db.query("SELECT COUNT(*) as count FROM snapshots").get()
  console.log("Total snapshots:", count.count)

  const snapshots = storage.getLatestSnapshots()
  console.log("Latest snapshots count:", snapshots.length)
  console.log("Latest snapshots:", JSON.stringify(snapshots, null, 2))

  if (snapshots.length === 0) {
    console.log("Debug: Dumping last 5 raw rows:")
    const raw = (storage as any).db.query("SELECT * FROM snapshots ORDER BY id DESC LIMIT 5").all()
    console.log(raw)
  }
} catch (e) {
  console.error("DB Error:", e)
}
