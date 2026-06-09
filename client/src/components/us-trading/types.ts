// Shared client-side types for US Trading (Alpaca Broker API)
// Mirrors the server-side interfaces — do NOT import from server in frontend code.

export interface AlpacaOptionContract {
	id: string;
	symbol: string;
	name: string;
	status: string;
	tradable: boolean;
	expiration_date: string;
	strike_price: string;
	type: "call" | "put";
	style: "american" | "european";
	underlying_symbol: string;
	underlying_asset_id: string;
	open_interest?: string;
	close_price?: string;
	open_price?: string;
}

export interface AlpacaAccountConfig {
	dtbp_check: "both" | "entry" | "exit";
	trade_confirm_email: "all" | "none";
	suspend_trade: boolean;
	no_shorting: boolean;
	fractional_trading: boolean;
	max_margin_multiplier: string;
	pdt_check: "both" | "entry" | "exit" | "none";
	ptp_no_exception_entry: boolean;
	max_options_trading_level: number | null;
}
