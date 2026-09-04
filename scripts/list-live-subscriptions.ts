import * as fs from "fs";

// Load .env.local
const envFile = fs.readFileSync(".env.local", "utf8");
const envVars: Record<string, string> = {};
for (const line of envFile.split("\n")) {
  const parts = line.split("=");
  if (parts.length >= 2) {
    const key = parts[0].trim();
    const val = parts.slice(1).join("=").trim().replace(/^["']|["']$/g, "");
    envVars[key] = val;
  }
}

const keyId = (process.env.RAZORPAY_KEY_ID || envVars.RAZORPAY_KEY_ID || "").trim();
const keySecret = (process.env.RAZORPAY_KEY_SECRET || envVars.RAZORPAY_KEY_SECRET || "").trim();

async function main() {
  const auth = Buffer.from(`${keyId}:${keySecret}`).toString("base64");
  const subRes = await fetch("https://api.razorpay.com/v1/subscriptions?count=50", {
    headers: { Authorization: `Basic ${auth}` },
  });
  const subData = await subRes.json();
  console.log("SUBSCRIPTIONS STATUS:", subRes.status);
  console.log("TOTAL SUBSCRIPTIONS:", subData.items?.length);
  if (subData.items) {
    subData.items.forEach((item: any, idx: number) => {
      console.log(`[${idx + 1}] ID: ${item.id} | Plan: ${item.plan_id} | Status: ${item.status} | Email: ${item.notes?.customer_email || "N/A"} | URL: ${item.short_url}`);
    });
  }

  const planRes = await fetch("https://api.razorpay.com/v1/plans?count=50", {
    headers: { Authorization: `Basic ${auth}` },
  });
  const planData = await planRes.json();
  console.log("\nTOTAL PLANS:", planData.items?.length);
  if (planData.items) {
    planData.items.slice(0, 10).forEach((p: any) => {
      console.log(`Plan ID: ${p.id} | Name: ${p.item?.name} | Amount: ${p.item?.amount}`);
    });
  }
}

main().catch(console.error);
