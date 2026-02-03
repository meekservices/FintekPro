-- Export bonds from development as INSERT statements
COPY (
  SELECT 
    'INSERT INTO bond_catalog (id, source, source_id, isin, bond_name, issuer_name, instrument_type, is_listed, exchange, face_value, coupon_rate, coupon_frequency, issue_date, maturity_date, clean_price, yield_to_maturity, credit_rating, rating_agency, min_investment, lot_size, tax_category, tds_applicable, tds_rate, net_yield_to_maturity, status, region, country, currency, created_at, updated_at) VALUES (' ||
    quote_literal(id) || ',' ||
    quote_literal(source) || ',' ||
    quote_literal(source_id) || ',' ||
    quote_literal(isin) || ',' ||
    quote_literal(bond_name) || ',' ||
    quote_literal(issuer_name) || ',' ||
    quote_literal(instrument_type) || ',' ||
    is_listed || ',' ||
    quote_literal(exchange) || ',' ||
    face_value || ',' ||
    coupon_rate || ',' ||
    quote_literal(coupon_frequency) || ',' ||
    quote_literal(issue_date) || ',' ||
    quote_literal(maturity_date) || ',' ||
    COALESCE(clean_price::text, 'NULL') || ',' ||
    COALESCE(yield_to_maturity::text, 'NULL') || ',' ||
    quote_literal(credit_rating) || ',' ||
    quote_literal(rating_agency) || ',' ||
    COALESCE(min_investment::text, 'NULL') || ',' ||
    lot_size || ',' ||
    quote_literal(tax_category) || ',' ||
    tds_applicable || ',' ||
    COALESCE(tds_rate::text, 'NULL') || ',' ||
    COALESCE(net_yield_to_maturity::text, 'NULL') || ',' ||
    quote_literal(status) || ',' ||
    COALESCE(quote_literal(region), 'NULL') || ',' ||
    COALESCE(quote_literal(country), 'NULL') || ',' ||
    COALESCE(quote_literal(currency), 'NULL') || ',' ||
    quote_literal(created_at) || ',' ||
    quote_literal(updated_at) || ') ON CONFLICT (id) DO NOTHING;'
  FROM bond_catalog
) TO STDOUT;
