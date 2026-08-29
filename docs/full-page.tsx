"use client"

import { useMemo, useState } from "react"
import {
  Bell, Box, CheckCircle2, Clock3, Download, FileText, FileWarning,
  History, LayoutDashboard, ListChecks, PackageSearch, RefreshCcw, Search,
  Settings, ShieldCheck, UploadCloud, XCircle
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"

type View = "dashboard" | "import" | "products" | "review" | "history" | "logs" | "settings"
type JobStatus = "Published" | "Processing" | "Needs Review" | "Failed" | "Draft"

type Product = {
  id: number
  name: string
  sku: string
  sourcePrice: number
  shopeePrice: number
  status: JobStatus
  updated: string
  stock: number
  weight: number
  category: string
  description: string
}

const initialProducts: Product[] = [
  { id: 1, name: "Wireless Mouse M331", sku: "LOG-M331", sourcePrice: 175000, shopeePrice: 210000, status: "Published", updated: "2 min ago", stock: 37, weight: 250, category: "Computer & Accessories > Mouse", description: "Quiet wireless mouse with ergonomic shape and long battery life." },
  { id: 2, name: "7-in-1 USB-C Hub", sku: "HUB-710", sourcePrice: 120000, shopeePrice: 144000, status: "Processing", updated: "4 min ago", stock: 22, weight: 180, category: "Computer & Accessories > USB Hubs", description: "Multi-port USB-C hub with HDMI, USB 3.0 and card reader." },
  { id: 3, name: "Portable LED Lamp", sku: "LED-042", sourcePrice: 48000, shopeePrice: 57600, status: "Needs Review", updated: "8 min ago", stock: 50, weight: 320, category: "", description: "Rechargeable portable LED lamp with adjustable brightness." },
  { id: 4, name: "Mechanical Keyboard K8", sku: "KEY-K8", sourcePrice: 250000, shopeePrice: 300000, status: "Failed", updated: "12 min ago", stock: 12, weight: 780, category: "Computer & Accessories > Keyboards", description: "Compact mechanical keyboard with hot-swappable switches." },
  { id: 5, name: "Bluetooth Speaker Mini", sku: "SPK-MINI", sourcePrice: 89000, shopeePrice: 107000, status: "Draft", updated: "26 min ago", stock: 18, weight: 410, category: "Audio > Speakers", description: "Portable Bluetooth speaker with compact enclosure." },
]

const historyRows = [
  ["#JOB-1042", "Wireless Mouse M331", "Published", "0", "11.8s", "Today 09:42"],
  ["#JOB-1041", "7-in-1 USB-C Hub", "Processing", "0", "—", "Today 09:39"],
  ["#JOB-1040", "Portable LED Lamp", "Needs Review", "0", "8.2s", "Today 09:31"],
  ["#JOB-1039", "Mechanical Keyboard K8", "Failed", "3", "32.7s", "Today 09:24"],
]

const logRows = [
  ["09:42:18", "INFO", "JOB-1042 accepted source URL"],
  ["09:42:19", "OK", "JakMall extraction returned 12 product fields"],
  ["09:42:20", "INFO", "Downloaded and validated 5 images"],
  ["09:42:22", "WARN", "Category mapping confidence 0.76 — operator review required"],
  ["09:44:10", "OK", "Shopee publish completed item_id=2387194421"],
  ["09:48:03", "ERROR", "JOB-1039 image upload timed out after attempt 3/3"],
]

const nav = [
  ["dashboard", "Dashboard", LayoutDashboard],
  ["import", "Import Products", UploadCloud],
  ["products", "Products", Box],
  ["review", "Review Queue", ShieldCheck],
  ["history", "History", History],
  ["logs", "Logs", FileText],
] as const

function money(v: number) { return `Rp ${v.toLocaleString("id-ID")}` }

function StatusBadge({ status }: { status: JobStatus | string }) {
  const styles: Record<string, string> = {
    Published: "bg-emerald-50 text-emerald-700",
    Processing: "bg-violet-50 text-violet-700",
    "Needs Review": "bg-amber-50 text-amber-700",
    Failed: "bg-rose-50 text-rose-700",
    Draft: "bg-sky-50 text-sky-700",
  }
  return <Badge className={`rounded-full border-0 px-2.5 py-1 text-[10px] hover:bg-inherit ${styles[status] ?? "bg-muted text-muted-foreground"}`}>● {status}</Badge>
}

function PageHeader({ title, description, actions }: { title: string; description: string; actions?: React.ReactNode }) {
  return <div className="flex flex-col gap-4 px-1 pt-1 sm:flex-row sm:items-end sm:justify-between">
    <div><h1 className="text-3xl font-bold tracking-[-0.04em]">{title}</h1><p className="mt-1 text-sm text-muted-foreground">{description}</p></div>
    {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
  </div>
}

export default function ListFlowPrototype() {
  const [view, setView] = useState<View>("dashboard")
  const [products, setProducts] = useState<Product[]>(initialProducts)
  const [productFilter, setProductFilter] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [importMode, setImportMode] = useState<"single" | "batch">("single")
  const [sourceUrl, setSourceUrl] = useState("https://www.jakmall.com/demo/wireless-mouse-m331")
  const [batchUrls, setBatchUrls] = useState("https://www.jakmall.com/demo/wireless-mouse-m331\nhttps://www.jakmall.com/demo/usb-c-hub\nhttps://www.jakmall.com/demo/led-lamp")
  const [markup, setMarkup] = useState("20")
  const [stage, setStage] = useState<1 | 2 | 3 | 4>(1)
  const [extracted, setExtracted] = useState<Product | null>(null)
  const [category, setCategory] = useState("")
  const [selected, setSelected] = useState<Product | null>(null)
  const [toast, setToast] = useState("")
  const [logFilter, setLogFilter] = useState("all")

  const notify = (text: string) => { setToast(text); window.setTimeout(() => setToast(""), 2300) }

  const filteredProducts = useMemo(() => products.filter(p => {
    const q = productFilter.toLowerCase()
    return (statusFilter === "all" || p.status === statusFilter) && (!q || p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q))
  }), [products, productFilter, statusFilter])

  const startExtraction = () => {
    if (importMode === "batch") {
      const count = batchUrls.split(/\n+/).filter(Boolean).length
      if (!count) return notify("Add at least one JakMall URL.")
      setStage(2); notify(`${count} products added to extraction queue.`)
      window.setTimeout(() => { setStage(3); notify("Batch extraction complete. 2 ready, 1 needs review.") }, 750)
      return
    }
    if (!sourceUrl.trim()) return notify("Paste a JakMall product URL first.")
    setStage(2); notify("Extracting and validating product data…")
    window.setTimeout(() => {
      const sourcePrice = 175000
      setExtracted({ id: Date.now(), name: "Wireless Mouse M331", sku: "LOG-M331", sourcePrice, shopeePrice: Math.round(sourcePrice * (1 + Number(markup || 20) / 100)), status: "Needs Review", updated: "just now", stock: 37, weight: 250, category: "", description: "Quiet wireless mouse with ergonomic shape, reliable wireless connection and long battery life." })
      setStage(3); notify("Extraction complete. Category requires review.")
    }, 850)
  }

  const publish = () => {
    if (!extracted) return
    if (!category) return notify("Choose a Shopee category before publishing.")
    const published = { ...extracted, category, status: "Published" as const, updated: "just now" }
    setProducts(prev => [published, ...prev]); setExtracted(published); setStage(4); notify("Published successfully — result recorded.")
  }

  const stats = [
    ["Products Published", "72", "12 published this week", true, CheckCircle2],
    ["Processing", "8", "3 jobs running now", false, Clock3],
    ["Needs Review", "3", "Category or attribute confirmation", false, FileWarning],
    ["Failed", "1", "Retry available", false, XCircle],
  ] as const

  return <main className="min-h-screen bg-[#dedee3] p-0 lg:p-10">
    <div className="mx-auto grid min-h-[900px] max-w-[1480px] grid-cols-1 gap-4 bg-white p-4 shadow-2xl lg:grid-cols-[235px_1fr] lg:p-6">
      <aside className="hidden rounded-3xl border bg-[#fbfbfc] p-4 lg:flex lg:flex-col">
        <div className="mb-7 flex items-center gap-3 px-2 text-xl font-black tracking-tight"><div className="grid size-9 place-items-center rounded-xl bg-violet-600 text-white">↗</div>ListFlow</div>
        <p className="px-3 pb-2 text-[10px] font-semibold uppercase tracking-[.16em] text-muted-foreground">Menu</p>
        <nav className="grid gap-1">{nav.map(([id, label, Icon]) => <button key={id} onClick={() => setView(id)} className={`flex items-center gap-3 rounded-xl px-3 py-3 text-left text-sm transition ${view === id ? "bg-white font-semibold shadow-sm" : "text-muted-foreground hover:bg-white"}`}><Icon className="size-4" />{label}</button>)}</nav>
        <p className="mt-6 px-3 pb-2 text-[10px] font-semibold uppercase tracking-[.16em] text-muted-foreground">General</p>
        <button onClick={() => setView("settings")} className={`flex items-center gap-3 rounded-xl px-3 py-3 text-left text-sm ${view === "settings" ? "bg-white font-semibold shadow-sm" : "text-muted-foreground hover:bg-white"}`}><Settings className="size-4" />Settings</button>
        <div className="mt-auto rounded-2xl bg-[radial-gradient(circle_at_90%_5%,#6557f5,transparent_38%),linear-gradient(145deg,#17132b,#0c0b18)] p-4 text-white"><p className="font-semibold">Automation ready</p><p className="mt-1 text-xs leading-5 text-white/60">Move products from JakMall to Shopee with less manual work.</p><Button onClick={() => setView("import")} className="mt-4 w-full rounded-xl bg-violet-600 hover:bg-violet-500">Import product</Button></div>
      </aside>

      <section className="min-w-0 space-y-4 rounded-3xl bg-[#f4f5f8] p-3 md:p-4">
        <header className="flex h-[68px] items-center gap-3 rounded-2xl border bg-[#fafafa] px-4"><div className="flex h-11 w-full max-w-md items-center gap-2 rounded-xl border bg-white px-3"><Search className="size-4 text-muted-foreground" /><Input className="h-auto border-0 p-0 shadow-none focus-visible:ring-0" placeholder="Search products, jobs, SKUs..." /></div><div className="flex-1" /><Button size="icon" variant="outline" className="rounded-xl"><Bell className="size-4" /></Button><div className="grid size-10 place-items-center rounded-xl bg-violet-100 text-xs font-bold text-violet-700">RA</div></header>

        {view === "dashboard" && <>
          <PageHeader title="Dashboard" description="Monitor JakMall imports and Shopee publishing activity." actions={<><Button variant="outline" className="rounded-xl" onClick={() => { setImportMode("batch"); setView("import") }}>Batch Import</Button><Button className="rounded-xl bg-violet-600" onClick={() => setView("import")}>+ Import Product</Button></>} />
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{stats.map(([label, value, meta, highlight, Icon]) => <Card key={label} className={`rounded-2xl shadow-none ${highlight ? "border-violet-600 bg-violet-600 text-white" : "bg-white"}`}><CardContent className="flex min-h-[145px] flex-col p-4"><div className="flex justify-between"><p className="text-xs font-semibold">{label}</p><div className={`grid size-8 place-items-center rounded-full border ${highlight ? "bg-white text-black" : ""}`}><Icon className="size-4" /></div></div><div className="mt-5 text-4xl font-black tracking-[-.05em]">{value}</div><p className={`mt-auto text-[11px] ${highlight ? "text-white/70" : "text-muted-foreground"}`}>{meta}</p></CardContent></Card>)}</div>
          <div className="grid gap-3 xl:grid-cols-[1.7fr_.75fr]">
            <Card className="rounded-2xl shadow-none"><CardHeader className="flex flex-row items-center justify-between"><div><CardTitle className="text-[15px]">Recent Product Jobs</CardTitle><p className="text-[11px] text-muted-foreground">Latest JakMall → Shopee automation runs</p></div><Button size="sm" variant="outline" className="rounded-xl" onClick={() => setView("history")}>View all</Button></CardHeader><CardContent><ProductsTable products={products.slice(0,4)} onOpen={setSelected} /></CardContent></Card>
            <div className="grid gap-3"><HealthCard /><Card className="rounded-2xl border-0 bg-[radial-gradient(circle_at_90%_5%,#6557f5,transparent_40%),linear-gradient(145deg,#17132b,#0c0b18)] text-white shadow-none"><CardContent className="p-5"><PackageSearch className="size-5 text-violet-300" /><h3 className="mt-4 font-semibold">Quick Import</h3><p className="mt-1 text-xs leading-5 text-white/60">Open the import workspace to extract and validate a JakMall product.</p><Button className="mt-4 w-full rounded-xl bg-violet-600" onClick={() => setView("import")}>Open Import</Button></CardContent></Card></div>
          </div>
        </>}

        {view === "import" && <>
          <PageHeader title="Import Products" description="Extract from JakMall, normalize the data, review mapping, then publish to Shopee." actions={<><Button variant="outline" className="rounded-xl" onClick={() => { setStage(1); setExtracted(null) }}>Reset</Button><Button className="rounded-xl bg-violet-600" onClick={startExtraction}>Extract Product</Button></>} />
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">{["Source","Extract","Review","Publish"].map((s,i) => <div key={s} className={`flex items-center gap-2 ${stage === i+1 ? "font-semibold text-violet-600" : stage > i+1 ? "text-emerald-600" : ""}`}><span className={`grid size-7 place-items-center rounded-full ${stage >= i+1 ? "bg-violet-600 text-white" : "bg-muted"}`}>{i+1}</span>{s}{i<3 && <span className="mx-1 h-px w-5 bg-border" />}</div>)}</div>
          <div className="grid gap-3 xl:grid-cols-[1.15fr_.85fr]">
            <Card className="rounded-2xl shadow-none"><CardHeader><div className="flex items-center justify-between"><div><CardTitle className="text-[15px]">Source & Automation Rules</CardTitle><p className="text-[11px] text-muted-foreground">Configure the import job.</p></div><div className="flex gap-2"><Button size="sm" variant={importMode === "single" ? "default" : "outline"} className="rounded-xl" onClick={() => setImportMode("single")}>Single</Button><Button size="sm" variant={importMode === "batch" ? "default" : "outline"} className="rounded-xl" onClick={() => setImportMode("batch")}>Batch</Button></div></div></CardHeader><CardContent className="space-y-5">
              {importMode === "single" ? <div className="grid gap-2"><Label>JakMall product URL</Label><Input value={sourceUrl} onChange={e=>setSourceUrl(e.target.value)} className="rounded-xl" /></div> : <div className="grid gap-2"><Label>JakMall URLs</Label><Textarea value={batchUrls} onChange={e=>setBatchUrls(e.target.value)} className="min-h-32 rounded-xl" /></div>}
              <div className="grid gap-4 sm:grid-cols-2"><div className="grid gap-2"><Label>Default markup (%)</Label><Input type="number" value={markup} onChange={e=>setMarkup(e.target.value)} className="rounded-xl" /></div><div className="grid gap-2"><Label>Destination</Label><Select defaultValue="id"><SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="id">Shopee Indonesia</SelectItem><SelectItem value="demo">Demo / Simulation</SelectItem></SelectContent></Select></div></div>
              {["Validate product images","Duplicate detection","Require review on uncertain mapping"].map((x,i)=><div key={x} className="flex items-center justify-between border-b py-3 last:border-0"><div><p className="text-xs font-semibold">{x}</p><p className="mt-1 text-[10px] text-muted-foreground">{i===0?"Validate availability, format and size.":i===1?"Compare source URL, source ID and SKU.":"Pause instead of guessing required marketplace attributes."}</p></div><Switch defaultChecked /></div>)}
            </CardContent></Card>
            <Card className="rounded-2xl shadow-none"><CardHeader><div className="flex items-center justify-between"><div><CardTitle className="text-[15px]">Extraction Preview</CardTitle><p className="text-[11px] text-muted-foreground">Normalized data before publishing.</p></div><StatusBadge status={extracted?.status ?? "Draft"} /></div></CardHeader><CardContent>{!extracted ? <div className="grid min-h-72 place-items-center rounded-2xl bg-violet-50 text-center"><div><PackageSearch className="mx-auto size-9 text-violet-600" /><p className="mt-3 text-sm font-semibold">Waiting for extraction</p><p className="mt-1 text-xs text-muted-foreground">Run a source URL to populate this preview.</p></div></div> : <div className="space-y-4"><div className="grid aspect-[1.5/1] place-items-center rounded-2xl bg-violet-50 text-3xl font-black text-violet-600">M331</div><div className="grid grid-cols-2 gap-2 text-xs"><MiniMetric label="Source price" value={money(extracted.sourcePrice)} /><MiniMetric label="Shopee price" value={money(extracted.shopeePrice)} /><MiniMetric label="SKU" value={extracted.sku} /><MiniMetric label="Stock" value={String(extracted.stock)} /></div><div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-[10px] leading-5 text-amber-800">Shopee category requires operator confirmation because the source and destination schemas may not map 1:1.</div></div>}</CardContent></Card>
          </div>
          {extracted && <Card className="rounded-2xl shadow-none"><CardHeader><div className="flex items-center justify-between"><div><CardTitle className="text-[15px]">Review & Normalize</CardTitle><p className="text-[11px] text-muted-foreground">Only confirm the values automation cannot safely infer.</p></div><StatusBadge status="Needs Review" /></div></CardHeader><CardContent className="space-y-4"><div className="grid gap-4 sm:grid-cols-2"><Field label="Product title" value={extracted.name} /><Field label="SKU" value={extracted.sku} /><Field label="Source price" value={String(extracted.sourcePrice)} /><Field label="Shopee price" value={String(extracted.shopeePrice)} /><Field label="Stock" value={String(extracted.stock)} /><Field label="Weight (g)" value={String(extracted.weight)} /></div><div className="grid gap-2"><Label>Shopee category</Label><Select value={category} onValueChange={setCategory}><SelectTrigger className="rounded-xl"><SelectValue placeholder="Select category" /></SelectTrigger><SelectContent><SelectItem value="Computer & Accessories > Mouse">Computer & Accessories &gt; Mouse</SelectItem><SelectItem value="Computer & Accessories > USB Hubs">Computer & Accessories &gt; USB Hubs</SelectItem><SelectItem value="Home & Living > Lighting">Home & Living &gt; Lighting</SelectItem></SelectContent></Select></div><div className="grid gap-2"><Label>Description</Label><Textarea defaultValue={extracted.description} className="min-h-28 rounded-xl" /></div><div className="flex justify-end gap-2"><Button variant="outline" className="rounded-xl" onClick={()=>notify("Saved as draft.")}>Save Draft</Button><Button className="rounded-xl bg-violet-600" onClick={publish}>Publish to Shopee</Button></div></CardContent></Card>}
        </>}

        {view === "products" && <><PageHeader title="Products" description="All extracted and published products in one operational view." actions={<Button className="rounded-xl bg-violet-600" onClick={()=>setView("import")}>+ Import Product</Button>} /><Card className="rounded-2xl shadow-none"><CardContent className="p-4"><div className="mb-4 flex flex-wrap gap-2"><Input value={productFilter} onChange={e=>setProductFilter(e.target.value)} className="max-w-xs rounded-xl" placeholder="Search product or SKU" /><Select value={statusFilter} onValueChange={setStatusFilter}><SelectTrigger className="w-44 rounded-xl"><SelectValue /></SelectTrigger><SelectContent>{["all","Published","Processing","Needs Review","Failed","Draft"].map(x=><SelectItem key={x} value={x}>{x==="all"?"All statuses":x}</SelectItem>)}</SelectContent></Select><div className="flex-1" /><Button variant="outline" className="rounded-xl" onClick={()=>notify("CSV export prepared.")}><Download className="mr-2 size-4" />Export CSV</Button></div><ProductsTable products={filteredProducts} onOpen={setSelected} /></CardContent></Card></>}

        {view === "review" && <><PageHeader title="Review Queue" description="Resolve only the fields that could not be mapped safely." /><Card className="rounded-2xl shadow-none"><CardHeader><CardTitle className="text-[15px]">Products requiring attention</CardTitle></CardHeader><CardContent className="space-y-3">{products.filter(p=>p.status==="Needs Review"||p.status==="Draft").map(p=><div key={p.id} className="grid gap-3 rounded-2xl border p-4 sm:grid-cols-[64px_1fr_auto] sm:items-center"><div className="grid size-16 place-items-center rounded-xl bg-violet-50 font-black text-violet-600">{p.name[0]}</div><div><p className="text-sm font-semibold">{p.name}</p><p className="mt-1 text-[10px] text-muted-foreground">SKU {p.sku}</p><div className="mt-2 flex gap-2"><Badge className="border-0 bg-amber-50 text-amber-700">Category required</Badge><Badge variant="outline">Human confirmation</Badge></div></div><div className="flex gap-2"><Button size="sm" variant="outline" className="rounded-xl">Later</Button><Button size="sm" className="rounded-xl bg-violet-600" onClick={()=>{setSourceUrl("https://www.jakmall.com/demo/review");setExtracted(p);setView("import");setStage(3)}}>Review</Button></div></div>)}</CardContent></Card></>}

        {view === "history" && <><PageHeader title="Processing History" description="Audit previous imports, retries and publishing outcomes." /><div className="grid gap-3 xl:grid-cols-[1.7fr_.75fr]"><Card className="rounded-2xl shadow-none"><CardContent className="p-4"><div className="overflow-hidden rounded-xl border"><Table><TableHeader><TableRow><TableHead>Job ID</TableHead><TableHead>Product</TableHead><TableHead>Status</TableHead><TableHead>Retries</TableHead><TableHead>Duration</TableHead><TableHead>Started</TableHead></TableRow></TableHeader><TableBody>{historyRows.map(r=><TableRow key={r[0]}>{r.map((c,i)=><TableCell key={i} className="text-xs">{i===2?<StatusBadge status={c}/>:c}</TableCell>)}</TableRow>)}</TableBody></Table></div></CardContent></Card><Card className="rounded-2xl shadow-none"><CardHeader><CardTitle className="text-[15px]">Selected Job</CardTitle></CardHeader><CardContent className="space-y-3 text-xs">{["Source accepted","Extraction complete","Mapping validated","Published"].map((x,i)=><div key={x} className="flex gap-3"><span className="mt-1 size-2 rounded-full bg-violet-600" /><div><p className="font-semibold">{x}</p><p className="mt-1 text-[10px] text-muted-foreground">{["JakMall URL validated.","12 fields and 5 images retrieved.","Category confirmed by operator.","Shopee item ID recorded."][i]}</p></div></div>)}<Button variant="outline" className="mt-2 w-full rounded-xl" onClick={()=>notify("Retry queued with backoff policy.")}><RefreshCcw className="mr-2 size-4" />Retry selected job</Button></CardContent></Card></div></>}

        {view === "logs" && <><PageHeader title="Logs" description="Structured operational logs for debugging and demo transparency." /><Card className="rounded-2xl shadow-none"><CardContent className="p-4"><div className="mb-4 flex gap-2"><Select value={logFilter} onValueChange={setLogFilter}><SelectTrigger className="w-40 rounded-xl"><SelectValue /></SelectTrigger><SelectContent>{["all","INFO","OK","WARN","ERROR"].map(x=><SelectItem key={x} value={x}>{x==="all"?"All levels":x}</SelectItem>)}</SelectContent></Select><div className="flex-1" /><span className="self-center text-[10px] text-muted-foreground">Sensitive tokens are redacted.</span></div><div className="font-mono text-[11px]">{logRows.filter(r=>logFilter==="all"||r[1]===logFilter).map((r,i)=><div key={i} className="grid grid-cols-[80px_70px_1fr] gap-2 border-b py-3 last:border-0"><span>{r[0]}</span><strong className={r[1]==="ERROR"?"text-rose-600":r[1]==="WARN"?"text-amber-600":r[1]==="OK"?"text-emerald-600":"text-sky-600"}>{r[1]}</strong><span>{r[2]}</span></div>)}</div></CardContent></Card></>}

        {view === "settings" && <><PageHeader title="Settings" description="Configure integrations, pricing rules, automation and security." actions={<Button className="rounded-xl bg-violet-600" onClick={()=>notify("Settings saved.")}>Save Changes</Button>} /><Card className="rounded-2xl shadow-none"><CardContent className="p-4"><Tabs defaultValue="connection"><TabsList className="mb-4 flex h-auto flex-wrap justify-start rounded-xl bg-muted/60 p-1"><TabsTrigger value="connection">Shopee Connection</TabsTrigger><TabsTrigger value="pricing">Pricing Rules</TabsTrigger><TabsTrigger value="automation">Automation</TabsTrigger><TabsTrigger value="security">Account & Security</TabsTrigger></TabsList><TabsContent value="connection"><div className="flex items-center gap-3 rounded-2xl border p-4"><div className="grid size-11 place-items-center rounded-xl bg-orange-50 font-black text-orange-600">S</div><div className="flex-1"><p className="text-sm font-semibold">Shopee Seller</p><p className="text-[10px] text-muted-foreground">Connected to demo seller account • token stored outside source code</p></div><Button variant="outline" className="rounded-xl" onClick={()=>notify("Shopee connection healthy.")}>Test Connection</Button></div></TabsContent><TabsContent value="pricing"><div className="grid gap-4 sm:grid-cols-2"><Field label="Default markup (%)" value="20" /><Field label="Minimum margin (%)" value="10" /><Field label="Marketplace buffer (IDR)" value="5000" /><div className="grid gap-2"><Label>Rounding rule</Label><Select defaultValue="1000"><SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="1000">Nearest Rp 1,000</SelectItem><SelectItem value="500">Nearest Rp 500</SelectItem><SelectItem value="none">No rounding</SelectItem></SelectContent></Select></div></div></TabsContent><TabsContent value="automation"><SettingSwitch title="Automatic retry" text="Retry transient failures up to three times with backoff." /><SettingSwitch title="Pause on CAPTCHA / 2FA" text="Never bypass access controls; require operator action." /><SettingSwitch title="Temporary image processing" text="Download, validate, upload and remove temporary files." /></TabsContent><TabsContent value="security"><SettingSwitch title="Require sign-in" text="Protect the internal dashboard from unauthenticated access." /><SettingSwitch title="Session timeout" text="Expire inactive sessions after the configured window." /><div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-[10px] leading-5 text-amber-800">Passwords, session cookies, access tokens and API secrets must not be committed to a public repository.</div></TabsContent></Tabs></CardContent></Card></>}
      </section>
    </div>

    <Dialog open={!!selected} onOpenChange={(open)=>!open&&setSelected(null)}><DialogContent className="rounded-3xl sm:max-w-2xl"><DialogHeader><DialogTitle>{selected?.name}</DialogTitle></DialogHeader>{selected && <div className="grid gap-4 sm:grid-cols-2"><div className="grid aspect-square place-items-center rounded-2xl bg-violet-50 text-4xl font-black text-violet-600">{selected.name[0]}</div><div className="space-y-3"><StatusBadge status={selected.status} /><MiniMetric label="SKU" value={selected.sku} /><MiniMetric label="Source price" value={money(selected.sourcePrice)} /><MiniMetric label="Shopee price" value={money(selected.shopeePrice)} /><MiniMetric label="Category" value={selected.category || "Needs confirmation"} /><p className="text-xs leading-5 text-muted-foreground">{selected.description}</p></div></div>}<DialogFooter><Button variant="outline" className="rounded-xl">Edit</Button><Button className="rounded-xl bg-violet-600" onClick={()=>notify("Sync job queued.")}>Sync to Shopee</Button></DialogFooter></DialogContent></Dialog>
    {toast && <div className="fixed bottom-6 right-6 z-50 rounded-xl bg-zinc-900 px-4 py-3 text-xs text-white shadow-2xl">{toast}</div>}
  </main>
}

function ProductsTable({ products, onOpen }: { products: Product[]; onOpen: (p: Product) => void }) {
  return <div className="overflow-hidden rounded-xl border"><Table><TableHeader><TableRow className="bg-muted/30"><TableHead>Product</TableHead><TableHead>Source price</TableHead><TableHead>Shopee price</TableHead><TableHead>Status</TableHead><TableHead>Updated</TableHead></TableRow></TableHeader><TableBody>{products.map(p=><TableRow key={p.id} className="cursor-pointer" onClick={()=>onOpen(p)}><TableCell><div className="flex items-center gap-3"><div className="grid size-10 place-items-center rounded-xl bg-violet-50 font-bold text-violet-600">{p.name[0]}</div><div><p className="text-xs font-semibold">{p.name}</p><p className="text-[10px] text-muted-foreground">SKU {p.sku}</p></div></div></TableCell><TableCell className="text-xs">{money(p.sourcePrice)}</TableCell><TableCell className="text-xs">{money(p.shopeePrice)}</TableCell><TableCell><StatusBadge status={p.status} /></TableCell><TableCell className="text-xs text-muted-foreground">{p.updated}</TableCell></TableRow>)}</TableBody></Table></div>
}

function HealthCard() { return <Card className="rounded-2xl shadow-none"><CardHeader className="pb-2"><CardTitle className="text-[15px]">Automation Health</CardTitle></CardHeader><CardContent>{[["JakMall Extractor","● Operational"],["Shopee Publisher","● Connected"],["Image Processor","● Operational"],["Queue","2 jobs"]].map(([k,v])=><div key={k} className="flex justify-between border-b py-3 text-xs last:border-0"><span className="text-muted-foreground">{k}</span><strong className={v.startsWith("●")?"text-emerald-600":""}>{v}</strong></div>)}</CardContent></Card> }
function MiniMetric({ label, value }: { label: string; value: string }) { return <div className="rounded-xl border p-3"><p className="text-[9px] text-muted-foreground">{label}</p><p className="mt-1 text-xs font-semibold">{value}</p></div> }
function Field({ label, value }: { label: string; value: string }) { return <div className="grid gap-2"><Label>{label}</Label><Input defaultValue={value} className="rounded-xl" /></div> }
function SettingSwitch({ title, text }: { title: string; text: string }) { return <div className="flex items-center justify-between border-b py-4 last:border-0"><div><p className="text-xs font-semibold">{title}</p><p className="mt-1 text-[10px] text-muted-foreground">{text}</p></div><Switch defaultChecked /></div> }
