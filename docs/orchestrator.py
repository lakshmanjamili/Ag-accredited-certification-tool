# """
# © 2026 Acroplans. All rights reserved. Proprietary and confidential. Unauthorized use, reproduction, or distribution is strictly prohibited unless explicitly permitted in writing by Acroplans.
# File: core/extraction/orchestrator.py
# Description: Multi-agent orchestrator with PARALLEL PROCESSING (Modern 2026 architecture)
# Author: Krishnarao.S - Acroplans
# 
# Change History:
# Version: 2.1.0
# Date: 2026-02-07
# Author: Krishnarao.S - Acroplans
# Changes:
# - PHASE 1: Removed investor_name parameter from extract_all() method
# - Agent now extracts investor name from Form 1040 (no manual entry)
# - Form1040Specialist.extract() called with investor_id only
# - All specialists work with extracted data, not manual input
#
# Version: 2.0.0
# Date: 2026-02-04
# - MAJOR OPTIMIZATION - Parallel agent execution with asyncio.gather()
#   * All 4 agents now run simultaneously instead of sequentially
#   * Processing time reduced from ~20 seconds to ~5 seconds (4x faster)
#   * Added robust error handling with return_exceptions=True
#   * Maintained backward compatibility with error handling
# - 2026-01-27: Renamed Part3Specialist → IncomeSpecialist
# - 2026-01-20: Initial creation with sequential processing
# """

import asyncio
from agno.knowledge.knowledge import Knowledge
from .form_1040_specialist import Form1040Specialist
from .k1_specialist import K1Specialist
from .income_specialist import IncomeSpecialist
from .net_worth_specialist import NetWorthSpecialist
from .schemas import ExtractionResult
from config.logging_config import get_logger

logger = get_logger('extraction.orchestrator')


class ExtractionOrchestrator:
    """
    Multi-agent orchestrator for document extraction with PARALLEL PROCESSING.
    
    Modern 2026 Architecture v2.1:
    - Coordinates 4 specialist agents running IN PARALLEL
    - Each agent returns structured JSON
    - No regex parsing needed
    - 4x faster processing than sequential approach
    - NO MANUAL INPUT: Extracts investor name from Form 1040
    
    SPECIALISTS (Run simultaneously):
    1. Form1040Specialist - Name, Address, filing status, AGI, years
    2. K1Specialist - Business/partnership income
    3. IncomeSpecialist - Current Year Income (W-2, PayStub, Employer Letter)
    4. NetWorthSpecialist - Bank, Brokerage, Real Estate, Liabilities
    
    PERFORMANCE:
    - Sequential (old): ~20 seconds (5s per agent × 4 agents)
    - Parallel (new): ~5 seconds (all agents run at once)
    - Speed improvement: 4x faster
    """
    
    def __init__(self, knowledge_base: Knowledge):
        self.form_1040_specialist = Form1040Specialist(knowledge_base)
        self.k1_specialist = K1Specialist(knowledge_base)
        self.income_specialist = IncomeSpecialist(knowledge_base)
        self.net_worth_specialist = NetWorthSpecialist(knowledge_base)
        
        logger.info("Orchestrator v2.1 initialized with 4 specialist agents (PARALLEL MODE)")
    
    async def extract_all(
        self,
        investor_id: str
    ) -> ExtractionResult:
        """
        Orchestrate all specialist agents to extract complete data IN PARALLEL.
        
        PHASE 1: NO MANUAL INPUT
        - Investor name is extracted by Form1040Specialist from Form 1040
        - No investor_name parameter needed
        - All data comes from document extraction
        
        Args:
            investor_id: Investor identifier (for document tracking only)
            
        Returns:
            ExtractionResult with all structured extractions including investor name
        """
        logger.info(f"Starting PARALLEL multi-agent extraction for {investor_id} (name will be extracted)")
        
        # PARALLEL EXECUTION - All agents run simultaneously
        # Using asyncio.gather with return_exceptions=True for robust error handling
        logger.info("Launching all 4 specialists in parallel...")
        
        results = await asyncio.gather(
            # Agent 1: Form 1040 (REQUIRED) - Extracts name + data
            self.form_1040_specialist.extract(
                investor_id=investor_id
                # NO investor_name parameter - extracted from form!
            ),
            
            # Agent 2: K-1 (OPTIONAL)
            self._safe_extract(
                self.k1_specialist,
                investor_id=investor_id,
                agent_name="K-1"
            ),
            
            # Agent 3: Income (OPTIONAL)
            self._safe_extract(
                self.income_specialist,
                investor_id=investor_id,
                agent_name="Income"
            ),
            
            # Agent 4: Net Worth (OPTIONAL)
            self._safe_extract(
                self.net_worth_specialist,
                investor_id=investor_id,
                agent_name="Net Worth"
            ),
            
            return_exceptions=True  # Don't fail entire extraction if one agent fails
        )
        
        # Unpack results
        form_1040_data, k1_data, income_data, net_worth_data = results
        
        # Handle Form 1040 errors (REQUIRED agent)
        if isinstance(form_1040_data, Exception):
            logger.error(f"Form 1040 extraction failed: {form_1040_data}")
            raise form_1040_data
        
        # Optional agents - already handled by _safe_extract, but check for exceptions
        if isinstance(k1_data, Exception):
            logger.warning(f"K-1 extraction failed: {k1_data}")
            k1_data = None
        
        if isinstance(income_data, Exception):
            logger.warning(f"Income extraction failed: {income_data}")
            income_data = None
        
        if isinstance(net_worth_data, Exception):
            logger.warning(f"Net Worth extraction failed: {net_worth_data}")
            net_worth_data = None
        
        # Combine all results
        extraction_result = ExtractionResult(
            form_1040=form_1040_data,
            k1_data=k1_data,
            income_data=income_data,
            net_worth_data=net_worth_data,
            investor_id=investor_id
        )
        
        logger.info(f"PARALLEL multi-agent extraction complete for {investor_id} (name extracted from Form 1040)")
        return extraction_result
    
    async def _safe_extract(self, specialist, investor_id: str, agent_name: str):
        """
        Wrapper for optional agents with error handling.
        Returns None on failure instead of raising exception.
        """
        try:
            return await specialist.extract(investor_id=investor_id)
        except Exception as e:
            logger.warning(f"{agent_name} extraction failed: {e}")
            return None
