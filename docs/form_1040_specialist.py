# """
# © 2026 Acroplans. All rights reserved. Proprietary and confidential. Unauthorized use, reproduction, or distribution is strictly prohibited unless explicitly permitted in writing by Acroplans.
# File: core/extraction/modern/form_1040_specialist.py
# Description: Form 1040 specialist agent (Modern 2026 multi-agent)
# Author: Krishnarao.S - Acroplans
# Last Updated: 2026-02-07
#
# Change History:
# 2026-02-07: FILING STATUS SUPPORT - Single + Joint Filing (Future-Ready)
# * Added spouse name extraction for joint/MFS/QSS filing statuses
# * Updated instructions to extract spouse_first_name, spouse_middle_initial, spouse_last_name
# * Added all 5 filing status options: Single, Married Filing Jointly, MFS, HOH, QSS
# * Updated JSON schema to include spouse fields (null for Single/HOH)
# * Agent conditionally extracts spouse name based on filing status
#
# 2026-02-07: P1 GAP FIX - Investor Name Extraction
# * Added name extraction instructions (Line 1a: first_name + middle_initial, Line 1b: last_name)
# * Updated JSON schema to include first_name, middle_initial, last_name fields
# * Eliminates manual CPA name entry requirement (Phase 1 -> Phase 2 transition)
# * Agent now extracts investor name directly from Form 1040
#
# 2026-01-20: Initial Implementation
# * Created Form 1040 specialist with structured extraction
# * Extracts address, filing status, AGI, tax years
# """

from .base_specialist import BaseSpecialistAgent
from .schemas import Form1040Data
from agno.knowledge.knowledge import Knowledge


class Form1040Specialist(BaseSpecialistAgent[Form1040Data]):
    """Specialist agent for Form 1040 extraction."""
    
    def __init__(self, knowledge_base: Knowledge):
        instructions = [
            "EXTRACT FROM FORM 1040:",
            "",
            "1. INVESTOR NAME (Primary Filer):",
            "   - Extract from Line 1a: First name and middle initial",
            "   - Extract from Line 1b: Last name",
            "   - Split into: first_name, middle_initial, last_name",
            "   - Example: Line 1a 'John M' → first_name: 'John', middle_initial: 'M'",
            "   - Example: Line 1b 'Doe' → last_name: 'Doe'",
            "",
            "2. SPOUSE NAME (If Joint/MFS/QSS Filing):",
            "   - Extract ONLY if filing status is Married Filing Jointly, MFS, or QSS",
            "   - Look for spouse line below Line 1b",
            "   - Extract: spouse_first_name, spouse_middle_initial, spouse_last_name",
            "   - If Single or Head of Household: spouse fields = null",
            "   - Example: 'Jane M Doe' → spouse_first_name: 'Jane', spouse_middle_initial: 'M', spouse_last_name: 'Doe'",
            "",
            "3. HOME ADDRESS:",
            "   - Find 'Home address (number and street)' on Form 1040 Page 1",
            "   - Format: 'STREET, CITY, STATE ZIP'",
            "   - Example: '8195 CUSTER RD, FRISCO, TX 75035'",
            "",
            "4. FILING STATUS (All 5 IRS Options):",
            "   - Check filing status checkboxes",
            "   - Return EXACTLY: 'Single', 'Married Filing Jointly', 'Married Filing Separately', 'Head of Household', or 'Qualifying Surviving Spouse'",
            "   - Match the exact string format above",
            "",
            "5. TAX YEARS:",
            "   - Extract from Form 1040 header: 'For the year Jan. 1–Dec. 31, YYYY'",
            "   - Do NOT use preparer dates or creation dates",
            "   - Return years as integers",
            "",
            "6. AGI (Adjusted Gross Income):",
            "   - Extract from LINE 11 ONLY",
            "   - NOT Line 1z (wages), NOT Line 9 (total income), NOT Line 15 (taxable)",
            "   - Return as {year: agi_amount}",
            "",
            "JSON SCHEMA:",
            "{",
            '  "first_name": "John",',
            '  "middle_initial": "M",',
            '  "last_name": "Doe",',
            '  "spouse_first_name": "Jane" (or null if Single/HOH),',
            '  "spouse_middle_initial": "M" (or null if Single/HOH),',
            '  "spouse_last_name": "Doe" (or null if Single/HOH),',
            '  "address": "STREET, CITY, STATE ZIP",',
            '  "filing_status": "Single"|"Married Filing Jointly"|"Married Filing Separately"|"Head of Household"|"Qualifying Surviving Spouse",',
            '  "agi_data": {2024: 300000.0, 2025: 320000.0},',
            '  "tax_years": [2024, 2025]',
            "}",
            "",
            "Return ONLY this JSON structure, nothing else."
        ]
        
        super().__init__(
            name="Form 1040 Specialist",
            knowledge_base=knowledge_base,
            response_model=Form1040Data,
            instructions=instructions
        )
    
    def _build_query(self, investor_id: str, **kwargs) -> str:
        investor_name = kwargs.get('investor_name', investor_id)
        
        return f"""
Extract Form 1040 data for {investor_name} (ID: {investor_id}).

Search knowledge base for Form 1040 documents.
Extract: home address, filing status, tax years, AGI from Line 11.

Return ONLY valid JSON matching the schema specified in instructions.
No explanations, no markdown, just raw JSON.
"""
