/**
 * Excel Add-in API routes — FintekPro MarketXLS-style Add-in
 *
 * Provides fast, CORS-open endpoints for the Excel custom functions
 * and task pane.  All data is read-only public market data (NSE option
 * chains, spot prices, expiry dates, Greeks).
 *
 * Route prefix: /api/excel
 */

import { Router, Request, Response } from 'express';
import { derivativesService } from '../services/derivatives-service';

const router = Router();

// ── CORS for Office.com (Excel Online) and localhost (Excel desktop) ──────────
const OFFICE_ORIGINS = [
  'https://excel.officeapps.live.com',
  'https://excel.office.com',
  'https://officeonline.com',
  'https://www.office.com',
  'https://o15.officeredir.microsoft.com',
  'https://addinslicensing.microsoft.com',
];

router.use((req, res, next) => {
  const origin = req.headers.origin ?? '';
  const allowed =
    OFFICE_ORIGINS.includes(origin) ||
    origin.endsWith('.officeapps.live.com') ||
    origin.endsWith('.office.com') ||
    /^https?:\/\/localhost(:\d+)?$/.test(origin) ||
    origin === '';           // same-origin task pane calls

  if (allowed) {
    res.setHeader('Access-Control-Allow-Origin', origin || '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.setHeader('Access-Control-Max-Age', '86400');
  }
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

// ── /api/excel/manifest  — dynamically generated manifest.xml ─────────────────
router.get('/manifest', (req: Request, res: Response) => {
  const proto = req.headers['x-forwarded-proto'] ?? req.protocol ?? 'https';
  const host  = req.headers['x-forwarded-host'] ?? req.headers.host ?? 'localhost:5000';
  const base  = `${proto}://${host}`;

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<OfficeApp
  xmlns="http://schemas.microsoft.com/office/appforoffice/1.1"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xmlns:bt="http://schemas.microsoft.com/office/officeappbasictypes/1.0"
  xmlns:ov="http://schemas.microsoft.com/office/taskpaneappversionoverrides"
  xsi:type="TaskPaneApp">

  <Id>fintekpro-excel-addin-001</Id>
  <Version>1.0.0</Version>
  <ProviderName>FintekPro</ProviderName>
  <DefaultLocale>en-IN</DefaultLocale>
  <DisplayName DefaultValue="FintekPro Options" />
  <Description DefaultValue="Live NSE option chains, Greeks and F&amp;O data in Excel" />
  <IconUrl DefaultValue="${base}/icon-192.png" />
  <HighResolutionIconUrl DefaultValue="${base}/icon-512.png" />
  <SupportUrl DefaultValue="https://fintekpro.com/support" />

  <Hosts>
    <Host Name="Workbook" />
  </Hosts>

  <DefaultSettings>
    <SourceLocation DefaultValue="${base}/excel-addin" />
  </DefaultSettings>

  <Permissions>ReadWriteDocument</Permissions>

  <VersionOverrides xmlns="http://schemas.microsoft.com/office/taskpaneappversionoverrides" xsi:type="VersionOverridesV1_0">
    <Hosts>
      <Host xsi:type="Workbook">

        <AllFormFactors>
          <ExtensionPoint xsi:type="CustomFunctions">
            <Script>
              <bt:Url resid="Functions.Script.Url" />
            </Script>
            <Page>
              <bt:Url resid="Functions.Page.Url" />
            </Page>
            <Metadata>
              <bt:Url resid="Functions.Metadata.Url" />
            </Metadata>
            <Namespace resid="Functions.Namespace" />
          </ExtensionPoint>
        </AllFormFactors>

        <DesktopFormFactor>
          <GetStarted>
            <Title resid="GetStarted.Title" />
            <Description resid="GetStarted.Description" />
            <LearnMoreUrl resid="LearnMore.Url" />
          </GetStarted>
          <ExtensionPoint xsi:type="PrimaryCommandSurface">
            <OfficeTab id="TabHome">
              <Group id="CommandsGroup">
                <Label resid="CommandsGroup.Label" />
                <Icon>
                  <bt:Image size="16" resid="Icon.16x16" />
                  <bt:Image size="32" resid="Icon.32x32" />
                  <bt:Image size="80" resid="Icon.80x80" />
                </Icon>
                <Control xsi:type="Button" id="OpenTaskPane">
                  <Label resid="TaskpaneButton.Label" />
                  <Supertip>
                    <Title resid="TaskpaneButton.Label" />
                    <Description resid="TaskpaneButton.Tooltip" />
                  </Supertip>
                  <Icon>
                    <bt:Image size="16" resid="Icon.16x16" />
                    <bt:Image size="32" resid="Icon.32x32" />
                    <bt:Image size="80" resid="Icon.80x80" />
                  </Icon>
                  <Action xsi:type="ShowTaskpane">
                    <TaskpaneId>FintekProPane</TaskpaneId>
                    <SourceLocation resid="Taskpane.Url" />
                  </Action>
                </Control>
              </Group>
            </OfficeTab>
          </ExtensionPoint>
        </DesktopFormFactor>
      </Host>
    </Hosts>

    <Resources>
      <bt:Images>
        <bt:Image id="Icon.16x16" DefaultValue="${base}/icon-192.png" />
        <bt:Image id="Icon.32x32" DefaultValue="${base}/icon-192.png" />
        <bt:Image id="Icon.80x80" DefaultValue="${base}/icon-192.png" />
      </bt:Images>
      <bt:Urls>
        <bt:Url id="Taskpane.Url"             DefaultValue="${base}/excel-addin" />
        <bt:Url id="Functions.Script.Url"     DefaultValue="${base}/excel-addin/functions.js" />
        <bt:Url id="Functions.Page.Url"       DefaultValue="${base}/excel-addin/functions-host.html" />
        <bt:Url id="Functions.Metadata.Url"   DefaultValue="${base}/excel-addin/functions.json" />
        <bt:Url id="LearnMore.Url"            DefaultValue="https://fintekpro.com/excel-addin" />
      </bt:Urls>
      <bt:ShortStrings>
        <bt:String id="Functions.Namespace"        DefaultValue="FINTEKPRO" />
        <bt:String id="GetStarted.Title"           DefaultValue="FintekPro Options Add-in loaded!" />
        <bt:String id="CommandsGroup.Label"        DefaultValue="FintekPro" />
        <bt:String id="TaskpaneButton.Label"       DefaultValue="Option Chain" />
        <bt:String id="TaskpaneButton.Tooltip"     DefaultValue="Open FintekPro Option Chain viewer" />
      </bt:ShortStrings>
      <bt:LongStrings>
        <bt:String id="GetStarted.Description"     DefaultValue="FintekPro provides live NSE option chains. Use =FINTEKPRO.OC() to pull live data." />
      </bt:LongStrings>
    </Resources>
  </VersionOverrides>
</OfficeApp>`;

  res.setHeader('Content-Type', 'application/xml');
  res.setHeader('Content-Disposition', 'attachment; filename="fintekpro-addin-manifest.xml"');
  res.send(xml);
});

// ── /api/excel/spot/:symbol — spot price ──────────────────────────────────────
router.get('/spot/:symbol', async (req: Request, res: Response) => {
  try {
    const symbol = req.params.symbol.toUpperCase();
    const chain = await derivativesService.getOptionsChain(symbol);
    res.json({ symbol, spot: chain.underlyingValue, timestamp: chain.timestamp });
  } catch {
    res.status(500).json({ error: 'Failed to fetch spot price' });
  }
});

// ── /api/excel/expiry/:symbol — expiry dates ──────────────────────────────────
router.get('/expiry/:symbol', async (req: Request, res: Response) => {
  try {
    const symbol = req.params.symbol.toUpperCase();
    const expiries = await derivativesService.getExpiryDates(symbol);
    const n = req.query.n ? parseInt(req.query.n as string) - 1 : undefined;
    if (n !== undefined) {
      res.json({ symbol, expiry: expiries[n] ?? null, index: n + 1 });
    } else {
      res.json({ symbol, expiryDates: expiries });
    }
  } catch {
    res.status(500).json({ error: 'Failed to fetch expiry dates' });
  }
});

// ── /api/excel/chain/:symbol — full option chain ──────────────────────────────
router.get('/chain/:symbol', async (req: Request, res: Response) => {
  try {
    const symbol = req.params.symbol.toUpperCase();
    const expiry = (req.query.expiry as string) || undefined;
    const chain = await derivativesService.getOptionsChain(symbol, expiry);

    // Return a flat array merging calls + puts by strike for easier Excel rendering
    const strikeMap = new Map<number, any>();
    for (const call of chain.options.calls) {
      strikeMap.set(call.strikePrice, { call });
    }
    for (const put of chain.options.puts) {
      const row = strikeMap.get(put.strikePrice) ?? {};
      row.put = put;
      strikeMap.set(put.strikePrice, row);
    }

    const rows = Array.from(strikeMap.entries())
      .sort(([a], [b]) => a - b)
      .map(([strike, { call, put }]) => ({
        strike,
        call_ltp:    call?.lastPrice ?? null,
        call_oi:     call?.openInterest ?? null,
        call_iv:     call?.impliedVolatility != null ? parseFloat(call.impliedVolatility.toFixed(2)) : null,
        call_change: call?.change != null ? parseFloat(call.change.toFixed(2)) : null,
        call_volume: call?.totalTradedVolume ?? null,
        call_bid:    call?.bidPrice ?? null,
        call_ask:    call?.askPrice ?? null,
        put_ltp:     put?.lastPrice ?? null,
        put_oi:      put?.openInterest ?? null,
        put_iv:      put?.impliedVolatility != null ? parseFloat(put.impliedVolatility.toFixed(2)) : null,
        put_change:  put?.change != null ? parseFloat(put.change.toFixed(2)) : null,
        put_volume:  put?.totalTradedVolume ?? null,
        put_bid:     put?.bidPrice ?? null,
        put_ask:     put?.askPrice ?? null,
      }));

    res.json({
      symbol,
      expiry: chain.options.calls[0]?.expiryDate ?? expiry ?? null,
      underlyingValue: chain.underlyingValue,
      timestamp: chain.timestamp,
      rows,
    });
  } catch {
    res.status(500).json({ error: 'Failed to fetch option chain' });
  }
});

// ── /api/excel/option/:symbol/:type/:strike/:expiry — single option ───────────
router.get('/option/:symbol/:type/:strike/:expiry', async (req: Request, res: Response) => {
  try {
    const { symbol, type, strike, expiry } = req.params;
    const field = ((req.query.field as string) ?? 'LTP').toUpperCase();
    const sym   = symbol.toUpperCase();
    const otype = type.toUpperCase() as 'CE' | 'PE';
    const sp    = parseFloat(strike);

    const chain = await derivativesService.getOptionsChain(sym, expiry);
    const legs  = otype === 'CE' ? chain.options.calls : chain.options.puts;
    const opt   = legs.find(o => o.strikePrice === sp);

    if (!opt) return res.json({ value: null, error: 'Strike not found' });

    const FIELD_MAP: Record<string, () => number | null> = {
      LTP:        () => opt.lastPrice,
      OI:         () => opt.openInterest,
      IV:         () => parseFloat(opt.impliedVolatility?.toFixed(4) ?? ''),
      CHANGE:     () => parseFloat(opt.change?.toFixed(2) ?? ''),
      CHANGE_PCT: () => parseFloat(opt.pChange?.toFixed(4) ?? ''),
      VOLUME:     () => opt.totalTradedVolume,
      BID:        () => opt.bidPrice,
      ASK:        () => opt.askPrice,
      BID_QTY:    () => opt.bidQty,
      ASK_QTY:    () => opt.askQty,
      SPOT:       () => opt.underlyingValue,
    };

    if (field === 'GREEKS') {
      const daysToExpiry = Math.max(
        0,
        (new Date(expiry).getTime() - Date.now()) / (1000 * 60 * 60 * 24),
      );
      const greeks = derivativesService.calculateGreeks(
        chain.underlyingValue,
        sp,
        daysToExpiry,
        (opt.impliedVolatility ?? 20) / 100,
        0.065,
        otype === 'CE' ? 'call' : 'put',
      );
      return res.json({ symbol: sym, type: otype, strike: sp, expiry, greeks });
    }

    const fn = FIELD_MAP[field];
    if (!fn) return res.status(400).json({ error: `Unknown field: ${field}. Valid: LTP OI IV CHANGE CHANGE_PCT VOLUME BID ASK BID_QTY ASK_QTY SPOT GREEKS` });

    res.json({ symbol: sym, type: otype, strike: sp, expiry, field, value: fn() });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ── /api/excel/symbols — available symbols ────────────────────────────────────
router.get('/symbols', async (_req: Request, res: Response) => {
  try {
    const data = await derivativesService.getAvailableSymbols();
    res.json(data);
  } catch {
    res.status(500).json({ error: 'Failed to fetch symbols' });
  }
});

export default router;
