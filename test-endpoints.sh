#!/bin/bash
# eCitizen SCC - Comprehensive Endpoint Testing
BASE="http://localhost:4010/api/v1"
PASS=0; FAIL=0; TOTAL=0
GREEN='\033[0;32m'; RED='\033[0;31m'; YELLOW='\033[1;33m'; NC='\033[0m'
TS=$(date +%s)

test_endpoint() {
  local method=$1 url=$2 data=$3 expected=$4 desc=$5 hdr=$6
  TOTAL=$((TOTAL + 1))
  if [ -n "$data" ]; then
    [ -n "$hdr" ] && response=$(curl -s -w "\n%{http_code}" -X "$method" "$BASE$url" -H "Content-Type: application/json" -H "$hdr" -d "$data" 2>/dev/null) || response=$(curl -s -w "\n%{http_code}" -X "$method" "$BASE$url" -H "Content-Type: application/json" -d "$data" 2>/dev/null)
  else
    [ -n "$hdr" ] && response=$(curl -s -w "\n%{http_code}" -X "$method" "$BASE$url" -H "$hdr" 2>/dev/null) || response=$(curl -s -w "\n%{http_code}" -X "$method" "$BASE$url" 2>/dev/null)
  fi
  status_code=$(echo "$response" | tail -1); body=$(echo "$response" | sed '$d')
  if [ "$status_code" = "$expected" ]; then
    PASS=$((PASS + 1)); echo -e "${GREEN}[PASS]${NC} $method $url ($status_code) - $desc"
  else
    FAIL=$((FAIL + 1)); echo -e "${RED}[FAIL]${NC} $method $url (got $status_code, expected $expected) - $desc"
    echo "  $(echo "$body" | head -c 200)"
  fi
}

echo "============================================"
echo "  eCitizen SCC - Endpoint Tests"
echo "============================================"

# === HEALTH (3) ===
echo -e "\n${YELLOW}--- Health Module ---${NC}"
test_endpoint GET "/health" "" "200" "Health check"
test_endpoint GET "/health/live" "" "200" "Liveness probe"
test_endpoint GET "/health/ready" "" "200" "Readiness probe"

# === AUTH (8) ===
echo -e "\n${YELLOW}--- Auth Module ---${NC}"
test_endpoint POST "/auth/register" "{\"email\":\"testuser${TS}@example.com\",\"password\":\"Test@12345\",\"firstName\":\"Test\",\"lastName\":\"User\"}" "201" "Register citizen"

ADMIN_LOGIN=$(curl -s -X POST "$BASE/auth/login" -H "Content-Type: application/json" -d '{"email":"admin@ecitizen.go.ke","password":"Admin@123456"}')
ADMIN_TOKEN=$(echo "$ADMIN_LOGIN" | python3 -c "import sys,json; print(json.load(sys.stdin).get('data',{}).get('accessToken',''))" 2>/dev/null)
ADMIN_REFRESH=$(echo "$ADMIN_LOGIN" | python3 -c "import sys,json; print(json.load(sys.stdin).get('data',{}).get('refreshToken',''))" 2>/dev/null)
TOTAL=$((TOTAL+1)); [ -n "$ADMIN_TOKEN" ] && { PASS=$((PASS+1)); echo -e "${GREEN}[PASS]${NC} POST /auth/login (200) - Admin login"; } || { FAIL=$((FAIL+1)); echo -e "${RED}[FAIL]${NC} POST /auth/login - Admin login failed"; }

CITIZEN_LOGIN=$(curl -s -X POST "$BASE/auth/login" -H "Content-Type: application/json" -d '{"email":"citizen@example.com","password":"Citizen@123"}')
CITIZEN_TOKEN=$(echo "$CITIZEN_LOGIN" | python3 -c "import sys,json; print(json.load(sys.stdin).get('data',{}).get('accessToken',''))" 2>/dev/null)
TOTAL=$((TOTAL+1)); [ -n "$CITIZEN_TOKEN" ] && { PASS=$((PASS+1)); echo -e "${GREEN}[PASS]${NC} POST /auth/login (200) - Citizen login"; } || { FAIL=$((FAIL+1)); echo -e "${RED}[FAIL]${NC} POST /auth/login - Citizen login failed"; }

AGENT_LOGIN=$(curl -s -X POST "$BASE/auth/login" -H "Content-Type: application/json" -d '{"email":"agent@icta.go.ke","password":"Agent@123"}')
AGENT_TOKEN=$(echo "$AGENT_LOGIN" | python3 -c "import sys,json; print(json.load(sys.stdin).get('data',{}).get('accessToken',''))" 2>/dev/null)
TOTAL=$((TOTAL+1)); [ -n "$AGENT_TOKEN" ] && { PASS=$((PASS+1)); echo -e "${GREEN}[PASS]${NC} POST /auth/login (200) - Agent login"; } || { FAIL=$((FAIL+1)); echo -e "${RED}[FAIL]${NC} POST /auth/login - Agent login failed"; }

AUTH="Authorization: Bearer $ADMIN_TOKEN"
CITIZEN_AUTH="Authorization: Bearer $CITIZEN_TOKEN"
AGENT_AUTH="Authorization: Bearer $AGENT_TOKEN"

ADMIN_ID=$(curl -s "$BASE/auth/me" -H "$AUTH" | python3 -c "import sys,json; print(json.load(sys.stdin).get('data',{}).get('id',''))" 2>/dev/null)
AGENT_ID=$(curl -s "$BASE/auth/me" -H "$AGENT_AUTH" | python3 -c "import sys,json; print(json.load(sys.stdin).get('data',{}).get('id',''))" 2>/dev/null)

test_endpoint GET "/auth/me" "" "200" "Get profile" "$AUTH"
test_endpoint POST "/auth/refresh" "{\"refreshToken\":\"$ADMIN_REFRESH\"}" "200" "Refresh token"
test_endpoint POST "/auth/forgot-password" '{"email":"admin@ecitizen.go.ke"}' "200" "Forgot password"
test_endpoint GET "/auth/me" "" "401" "Protected without token"

# === USERS (7) ===
echo -e "\n${YELLOW}--- Users Module ---${NC}"
test_endpoint GET "/users" "" "200" "List users" "$AUTH"
test_endpoint GET "/users?page=1&limit=5" "" "200" "Paginated users" "$AUTH"
test_endpoint GET "/users/$ADMIN_ID" "" "200" "Get user by ID" "$AUTH"

CREATE_USER=$(curl -s -w "\n%{http_code}" -X POST "$BASE/users" -H "Content-Type: application/json" -H "$AUTH" -d "{\"email\":\"agent${TS}@test.com\",\"password\":\"Agent@123\",\"firstName\":\"New\",\"lastName\":\"Agent\",\"userType\":\"AGENCY_AGENT\"}")
CU_STATUS=$(echo "$CREATE_USER" | tail -1); CU_BODY=$(echo "$CREATE_USER" | sed '$d')
NEW_USER_ID=$(echo "$CU_BODY" | python3 -c "import sys,json; print(json.load(sys.stdin).get('data',{}).get('id',''))" 2>/dev/null)
TOTAL=$((TOTAL+1)); [ "$CU_STATUS" = "201" ] && { PASS=$((PASS+1)); echo -e "${GREEN}[PASS]${NC} POST /users (201) - Create user"; } || { FAIL=$((FAIL+1)); echo -e "${RED}[FAIL]${NC} POST /users ($CU_STATUS) - Create user"; echo "  $(echo "$CU_BODY" | head -c 200)"; }
[ -n "$NEW_USER_ID" ] && {
  test_endpoint PATCH "/users/$NEW_USER_ID" '{"firstName":"Updated"}' "200" "Update user" "$AUTH"
  test_endpoint PATCH "/users/$NEW_USER_ID/status" '{"isActive":false}' "200" "Deactivate user" "$AUTH"
  test_endpoint DELETE "/users/$NEW_USER_ID" "" "200" "Soft delete user" "$AUTH"
}

# === AGENCIES (16) ===
echo -e "\n${YELLOW}--- Agencies Module ---${NC}"
test_endpoint GET "/agencies" "" "200" "List agencies" "$AUTH"

AGENCIES_LIST=$(curl -s "$BASE/agencies" -H "$AUTH")
FIRST_AGENCY_ID=$(echo "$AGENCIES_LIST" | python3 -c "import sys,json; d=json.load(sys.stdin).get('data',[]); print(d[0]['id'] if d else '')" 2>/dev/null)

test_endpoint POST "/agencies" "{\"agencyCode\":\"TST-${TS}\",\"agencyName\":\"Test Agency ${TS}\",\"agencyType\":\"MINISTRY\",\"officialEmail\":\"test${TS}@agency.go.ke\",\"county\":\"Nairobi\"}" "201" "Create agency" "$AUTH"
test_endpoint GET "/agencies/$FIRST_AGENCY_ID" "" "200" "Get agency" "$AUTH"
test_endpoint PATCH "/agencies/$FIRST_AGENCY_ID" '{"officialPhone":"+254201234567"}' "200" "Update agency" "$AUTH"
test_endpoint GET "/agencies/$FIRST_AGENCY_ID/departments" "" "200" "List departments" "$AUTH"
test_endpoint POST "/agencies/$FIRST_AGENCY_ID/departments" "{\"departmentName\":\"QA Dept ${TS}\",\"departmentCode\":\"QA-${TS}\"}" "201" "Create department" "$AUTH"
test_endpoint GET "/agencies/$FIRST_AGENCY_ID/contacts" "" "200" "List contacts" "$AUTH"
test_endpoint POST "/agencies/$FIRST_AGENCY_ID/contacts" '{"contactName":"Jane","email":"jane@test.go.ke","phone":"+254700000001","escalationLevel":1}' "201" "Create contact" "$AUTH"
test_endpoint GET "/agencies/$FIRST_AGENCY_ID/business-hours" "" "200" "List business hours" "$AUTH"
test_endpoint PUT "/agencies/$FIRST_AGENCY_ID/business-hours" '{"hours":[{"dayOfWeek":1,"startTime":"08:00","endTime":"17:00"},{"dayOfWeek":2,"startTime":"08:00","endTime":"17:00"}]}' "200" "Set business hours" "$AUTH"
test_endpoint GET "/agencies/$FIRST_AGENCY_ID/settings" "" "200" "List settings" "$AUTH"
test_endpoint POST "/agencies/$FIRST_AGENCY_ID/settings" "{\"settingKey\":\"max_tickets_${TS}\",\"settingValue\":\"100\"}" "201" "Create setting" "$AUTH"
test_endpoint PUT "/agencies/$FIRST_AGENCY_ID/settings" "{\"settingKey\":\"max_tickets_${TS}\",\"settingValue\":\"200\"}" "200" "Update setting (PUT)" "$AUTH"
test_endpoint POST "/service-providers" "{\"providerName\":\"Test Provider ${TS}\",\"providerType\":\"EXTERNAL\",\"contactEmail\":\"prov${TS}@test.com\"}" "201" "Create service provider" "$AUTH"
test_endpoint GET "/service-providers" "" "200" "List service providers" "$AUTH"
test_endpoint GET "/agencies/$FIRST_AGENCY_ID/service-providers" "" "200" "Agency service providers" "$AUTH"

# === TICKETS (19) ===
echo -e "\n${YELLOW}--- Tickets Module ---${NC}"
test_endpoint GET "/ticket-categories?agencyId=$FIRST_AGENCY_ID" "" "200" "List categories" "$AUTH"
test_endpoint GET "/ticket-priorities" "" "200" "List priorities" "$AUTH"
test_endpoint GET "/ticket-statuses" "" "200" "List statuses" "$AUTH"

CATEGORY=$(curl -s "$BASE/ticket-categories?agencyId=$FIRST_AGENCY_ID" -H "$AUTH" | python3 -c "import sys,json; c=json.load(sys.stdin).get('data',[]); print(c[0]['id'] if c else '')" 2>/dev/null)
PRIORITY=$(curl -s "$BASE/ticket-priorities" -H "$AUTH" | python3 -c "import sys,json; p=json.load(sys.stdin).get('data',[]); print(next((x['id'] for x in p if x['name']=='MEDIUM'),''))" 2>/dev/null)

CAT_FIELD=""; [ -n "$CATEGORY" ] && CAT_FIELD=",\"categoryId\":\"$CATEGORY\""
CT=$(curl -s -w "\n%{http_code}" -X POST "$BASE/tickets" -H "Content-Type: application/json" -H "$CITIZEN_AUTH" -d "{\"subject\":\"Cannot access account\",\"description\":\"Login issues since yesterday.\",\"agencyId\":\"$FIRST_AGENCY_ID\"${CAT_FIELD},\"priorityId\":\"$PRIORITY\",\"channel\":\"WEB\"}")
CT_S=$(echo "$CT" | tail -1); CT_B=$(echo "$CT" | sed '$d')
TICKET_ID=$(echo "$CT_B" | python3 -c "import sys,json; print(json.load(sys.stdin).get('data',{}).get('id',''))" 2>/dev/null)
TOTAL=$((TOTAL+1)); [ "$CT_S" = "201" ] && { PASS=$((PASS+1)); echo -e "${GREEN}[PASS]${NC} POST /tickets (201) - Create ticket"; } || { FAIL=$((FAIL+1)); echo -e "${RED}[FAIL]${NC} POST /tickets ($CT_S)"; echo "  $(echo "$CT_B" | head -c 300)"; }

test_endpoint GET "/tickets" "" "200" "List tickets" "$AUTH"
test_endpoint GET "/tickets?page=1&limit=5" "" "200" "Paginated tickets" "$AUTH"

[ -n "$TICKET_ID" ] && {
  test_endpoint GET "/tickets/$TICKET_ID" "" "200" "Get ticket" "$AUTH"
  test_endpoint POST "/tickets/$TICKET_ID/messages" '{"messageText":"Help urgently please","messageType":"COMMENT"}' "201" "Add message" "$CITIZEN_AUTH"
  test_endpoint GET "/tickets/$TICKET_ID/messages" "" "200" "Get messages" "$AUTH"
  test_endpoint GET "/tickets/$TICKET_ID/history" "" "200" "Get history" "$AUTH"
  test_endpoint POST "/tickets/$TICKET_ID/assign" "{\"assigneeId\":\"$AGENT_ID\"}" "200" "Assign ticket" "$AUTH"
  test_endpoint PATCH "/tickets/$TICKET_ID" '{"subject":"Updated: Cannot access account"}' "200" "Update ticket" "$AUTH"
  test_endpoint POST "/tickets/$TICKET_ID/tags" '{"tags":["login-issue","urgent"]}' "201" "Add tags" "$AUTH"
  test_endpoint POST "/tickets/$TICKET_ID/resolve" '{"resolutionNotes":"Issue resolved after investigation"}' "200" "Resolve ticket" "$AUTH"
  test_endpoint POST "/tickets/$TICKET_ID/close" '{"reason":"Confirmed resolved by citizen"}' "200" "Close ticket" "$AUTH"
}

CT2=$(curl -s -w "\n%{http_code}" -X POST "$BASE/tickets" -H "Content-Type: application/json" -H "$CITIZEN_AUTH" -d "{\"subject\":\"Payment not reflected\",\"description\":\"Payment 3 days ago not showing.\",\"agencyId\":\"$FIRST_AGENCY_ID\"${CAT_FIELD},\"priorityId\":\"$PRIORITY\",\"channel\":\"MOBILE\"}")
CT2_S=$(echo "$CT2" | tail -1); CT2_B=$(echo "$CT2" | sed '$d')
TICKET2_ID=$(echo "$CT2_B" | python3 -c "import sys,json; print(json.load(sys.stdin).get('data',{}).get('id',''))" 2>/dev/null)
TOTAL=$((TOTAL+1)); [ "$CT2_S" = "201" ] && { PASS=$((PASS+1)); echo -e "${GREEN}[PASS]${NC} POST /tickets (201) - Second ticket"; } || { FAIL=$((FAIL+1)); echo -e "${RED}[FAIL]${NC} POST /tickets ($CT2_S) - Second ticket"; }

# === SLA (10) ===
echo -e "\n${YELLOW}--- SLA Module ---${NC}"
test_endpoint GET "/sla/policies" "" "200" "List SLA policies" "$AUTH"

CS=$(curl -s -w "\n%{http_code}" -X POST "$BASE/sla/policies" -H "Content-Type: application/json" -H "$AUTH" -d "{\"agencyId\":\"$FIRST_AGENCY_ID\",\"policyName\":\"Test SLA ${TS}\",\"isActive\":true,\"appliesBusinessHours\":false}")
CS_S=$(echo "$CS" | tail -1); CS_B=$(echo "$CS" | sed '$d')
SLA_ID=$(echo "$CS_B" | python3 -c "import sys,json; print(json.load(sys.stdin).get('data',{}).get('id',''))" 2>/dev/null)
TOTAL=$((TOTAL+1)); [ "$CS_S" = "201" ] && { PASS=$((PASS+1)); echo -e "${GREEN}[PASS]${NC} POST /sla/policies (201)"; } || { FAIL=$((FAIL+1)); echo -e "${RED}[FAIL]${NC} POST /sla/policies ($CS_S)"; echo "  $(echo "$CS_B" | head -c 200)"; }

[ -n "$SLA_ID" ] && {
  test_endpoint GET "/sla/policies/$SLA_ID" "" "200" "Get SLA policy" "$AUTH"
  test_endpoint PATCH "/sla/policies/$SLA_ID" '{"description":"Updated"}' "200" "Update SLA policy" "$AUTH"
  test_endpoint POST "/sla/policies/$SLA_ID/rules" "{\"priorityId\":\"$PRIORITY\",\"responseTimeMinutes\":30,\"resolutionTimeMinutes\":240}" "201" "Create SLA rule" "$AUTH"
}

# SLA tracking only exists if a matching policy was set up before ticket creation; 404 is valid here
[ -n "$TICKET_ID" ] && test_endpoint GET "/sla/tracking/$TICKET_ID" "" "404" "SLA tracking (no policy)" "$AUTH"
test_endpoint GET "/sla/breaches" "" "200" "SLA breaches" "$AUTH"
test_endpoint GET "/sla/escalation-matrix" "" "200" "Escalation matrices" "$AUTH"
test_endpoint POST "/sla/escalation-matrix" "{\"agencyId\":\"$FIRST_AGENCY_ID\",\"priorityLevel\":\"HIGH\",\"maxResponseTimeMinutes\":60,\"maxResolutionTimeMinutes\":480}" "201" "Create escalation matrix" "$AUTH"

# === WORKFLOW (5) ===
echo -e "\n${YELLOW}--- Workflow Module ---${NC}"
test_endpoint GET "/workflow/automation-rules" "" "200" "List rules" "$AUTH"

CR=$(curl -s -w "\n%{http_code}" -X POST "$BASE/workflow/automation-rules" -H "Content-Type: application/json" -H "$AUTH" -d "{\"agencyId\":\"$FIRST_AGENCY_ID\",\"ruleName\":\"Auto-escalate ${TS}\",\"triggerEvent\":\"TICKET_CREATED\",\"conditionExpression\":{\"field\":\"priority\",\"operator\":\"eq\",\"value\":\"CRITICAL\"},\"isActive\":true}")
CR_S=$(echo "$CR" | tail -1); CR_B=$(echo "$CR" | sed '$d')
RULE_ID=$(echo "$CR_B" | python3 -c "import sys,json; print(json.load(sys.stdin).get('data',{}).get('id',''))" 2>/dev/null)
TOTAL=$((TOTAL+1)); [ "$CR_S" = "201" ] && { PASS=$((PASS+1)); echo -e "${GREEN}[PASS]${NC} POST /workflow/automation-rules (201)"; } || { FAIL=$((FAIL+1)); echo -e "${RED}[FAIL]${NC} POST /workflow/automation-rules ($CR_S)"; echo "  $(echo "$CR_B" | head -c 200)"; }

[ -n "$RULE_ID" ] && {
  test_endpoint PATCH "/workflow/automation-rules/$RULE_ID" '{"isActive":false}' "200" "Update rule" "$AUTH"
  test_endpoint POST "/workflow/automation-rules/$RULE_ID/actions" '{"actionType":"CHANGE_PRIORITY","actionConfig":{"priority":"HIGH"},"executionOrder":1}' "201" "Add action" "$AUTH"
}
[ -n "$TICKET_ID" ] && test_endpoint GET "/workflow/triggers?ticketId=$TICKET_ID" "" "200" "List triggers" "$AUTH"

# === NOTIFICATIONS (6) ===
echo -e "\n${YELLOW}--- Notifications Module ---${NC}"
test_endpoint GET "/notifications" "" "200" "List notifications" "$AUTH"
test_endpoint GET "/notifications/templates" "" "200" "List templates" "$AUTH"

CNT=$(curl -s -w "\n%{http_code}" -X POST "$BASE/notifications/templates" -H "Content-Type: application/json" -H "$AUTH" -d '{"templateName":"test_tmpl2","channel":"EMAIL","subjectTemplate":"Test","bodyTemplate":"Hello {{name}}"}')
CNT_S=$(echo "$CNT" | tail -1); CNT_B=$(echo "$CNT" | sed '$d')
TMPL_ID=$(echo "$CNT_B" | python3 -c "import sys,json; print(json.load(sys.stdin).get('data',{}).get('id',''))" 2>/dev/null)
TOTAL=$((TOTAL+1)); [ "$CNT_S" = "201" ] && { PASS=$((PASS+1)); echo -e "${GREEN}[PASS]${NC} POST /notifications/templates (201)"; } || { FAIL=$((FAIL+1)); echo -e "${RED}[FAIL]${NC} POST /notifications/templates ($CNT_S)"; echo "  $(echo "$CNT_B" | head -c 200)"; }
[ -n "$TMPL_ID" ] && test_endpoint PATCH "/notifications/templates/$TMPL_ID" '{"bodyTemplate":"Updated"}' "200" "Update template" "$AUTH"

test_endpoint POST "/notifications/send" "{\"channel\":\"EMAIL\",\"recipients\":[{\"recipientUserId\":\"$ADMIN_ID\",\"recipientEmail\":\"admin@ecitizen.go.ke\"}],\"templateName\":\"ticket_created\",\"variables\":{\"ticketNumber\":\"ESCC-001\",\"citizenName\":\"John\",\"subject\":\"Test\"}}" "201" "Send notification" "$AUTH"

# === KB (11) ===
echo -e "\n${YELLOW}--- Knowledge Base Module ---${NC}"
CKC=$(curl -s -w "\n%{http_code}" -X POST "$BASE/kb/categories" -H "Content-Type: application/json" -H "$AUTH" -d "{\"name\":\"Getting Started ${TS}\",\"description\":\"How to start\"}")
CKC_S=$(echo "$CKC" | tail -1); CKC_B=$(echo "$CKC" | sed '$d')
KB_CAT_ID=$(echo "$CKC_B" | python3 -c "import sys,json; print(json.load(sys.stdin).get('data',{}).get('id',''))" 2>/dev/null)
TOTAL=$((TOTAL+1)); [ "$CKC_S" = "201" ] && { PASS=$((PASS+1)); echo -e "${GREEN}[PASS]${NC} POST /kb/categories (201)"; } || { FAIL=$((FAIL+1)); echo -e "${RED}[FAIL]${NC} POST /kb/categories ($CKC_S)"; echo "  $(echo "$CKC_B" | head -c 200)"; }
test_endpoint GET "/kb/categories" "" "200" "List KB categories" "$AUTH"

[ -n "$KB_CAT_ID" ] && {
  CKA=$(curl -s -w "\n%{http_code}" -X POST "$BASE/kb/articles" -H "Content-Type: application/json" -H "$AUTH" -d "{\"title\":\"How to Register 2\",\"content\":\"Visit ecitizen.go.ke and register.\",\"categoryId\":\"$KB_CAT_ID\"}")
  CKA_S=$(echo "$CKA" | tail -1); CKA_B=$(echo "$CKA" | sed '$d')
  KB_ART_ID=$(echo "$CKA_B" | python3 -c "import sys,json; print(json.load(sys.stdin).get('data',{}).get('id',''))" 2>/dev/null)
  TOTAL=$((TOTAL+1)); [ "$CKA_S" = "201" ] && { PASS=$((PASS+1)); echo -e "${GREEN}[PASS]${NC} POST /kb/articles (201)"; } || { FAIL=$((FAIL+1)); echo -e "${RED}[FAIL]${NC} POST /kb/articles ($CKA_S)"; echo "  $(echo "$CKA_B" | head -c 200)"; }
  test_endpoint GET "/kb/articles" "" "200" "List articles" "$AUTH"
  [ -n "$KB_ART_ID" ] && {
    test_endpoint GET "/kb/articles/$KB_ART_ID" "" "200" "Get article" "$AUTH"
    test_endpoint PATCH "/kb/articles/$KB_ART_ID" '{"title":"Updated Article Title"}' "200" "Update article" "$AUTH"
    test_endpoint POST "/kb/articles/$KB_ART_ID/versions" '{"content":"Updated content for version 2 of this article, with enough characters.","changeNotes":"V2 update"}' "201" "Create version" "$AUTH"
    test_endpoint POST "/kb/articles/$KB_ART_ID/publish" "" "201" "Publish article" "$AUTH"
    test_endpoint POST "/kb/articles/$KB_ART_ID/feedback" '{"wasHelpful":true,"feedbackComment":"Great article!"}' "201" "Feedback" "$CITIZEN_AUTH"
    test_endpoint GET "/kb/articles/$KB_ART_ID/feedback" "" "200" "Get feedback" "$AUTH"
  }
}
test_endpoint POST "/kb/tags" "{\"name\":\"tag${TS}\"}" "201" "Create tag" "$AUTH"
test_endpoint GET "/kb/tags" "" "200" "List tags" "$AUTH"

# === AI (9) ===
echo -e "\n${YELLOW}--- AI Module ---${NC}"
[ -n "$TICKET2_ID" ] && test_endpoint POST "/ai/classify" "{\"ticketId\":\"$TICKET2_ID\",\"autoApply\":false}" "201" "Classify ticket" "$AUTH"
test_endpoint GET "/ai/metrics" "" "200" "AI metrics" "$AUTH"
test_endpoint GET "/ai/classifications" "" "200" "Classifications" "$AUTH"
test_endpoint GET "/ai/models" "" "200" "AI models" "$AUTH"
test_endpoint POST "/ai/models" "{\"modelName\":\"classifier-${TS}\",\"modelVersion\":\"1.0.0\",\"modelType\":\"classification\",\"isActive\":false}" "201" "Register model" "$AUTH"
[ -n "$TICKET2_ID" ] && test_endpoint GET "/ai/recommendations?ticketId=$TICKET2_ID" "" "200" "Recommendations" "$AUTH"

CL_ID=$(curl -s "$BASE/ai/classifications" -H "$AUTH" | python3 -c "import sys,json; d=json.load(sys.stdin).get('data',[]); print(d[0]['id'] if d else '')" 2>/dev/null)
[ -n "$CL_ID" ] && {
  test_endpoint POST "/ai/override" "{\"classificationId\":\"$CL_ID\",\"overriddenCategoryId\":\"$CATEGORY\",\"reason\":\"Manual\"}" "201" "Override classification" "$AUTH"
  test_endpoint POST "/ai/feedback" "{\"classificationId\":\"$CL_ID\",\"isAccurate\":true,\"feedbackNotes\":\"Correct\"}" "201" "AI feedback" "$AUTH"
}

# === AUDIT (4) ===
echo -e "\n${YELLOW}--- Audit Module ---${NC}"
test_endpoint GET "/audit/logs" "" "200" "Audit logs" "$AUTH"
test_endpoint GET "/audit/user-activity" "" "200" "User activity" "$AUTH"
test_endpoint GET "/audit/data-access" "" "200" "Data access logs" "$AUTH"

AL_ID=$(curl -s "$BASE/audit/logs" -H "$AUTH" | python3 -c "import sys,json; d=json.load(sys.stdin).get('data',[]); print(d[0]['id'] if d else '')" 2>/dev/null)
[ -n "$AL_ID" ] && test_endpoint GET "/audit/logs/$AL_ID" "" "200" "Get audit log" "$AUTH"

# === REPORTING (8) ===
echo -e "\n${YELLOW}--- Reporting Module ---${NC}"
test_endpoint GET "/reports/dashboard/metrics" "" "200" "Dashboard metrics" "$AUTH"
test_endpoint GET "/reports/sla" "" "200" "SLA report" "$AUTH"
test_endpoint GET "/reports/agency-performance" "" "200" "Agency performance" "$AUTH"
test_endpoint GET "/reports/ticket-metrics/hourly" "" "200" "Hourly metrics" "$AUTH"
test_endpoint GET "/reports/ticket-metrics/daily" "" "200" "Daily metrics" "$AUTH"
test_endpoint GET "/reports/user-performance?userId=$AGENT_ID" "" "200" "User performance" "$AUTH"
test_endpoint GET "/reports/snapshots" "" "200" "Snapshots" "$AUTH"
test_endpoint POST "/reports/export" '{"reportType":"DASHBOARD","format":"CSV"}' "201" "Export CSV" "$AUTH"

# === MEDIA (8) ===
echo -e "\n${YELLOW}--- Media Module ---${NC}"
echo "test content" > /tmp/test-upload.txt
UL=$(curl -s -w "\n%{http_code}" -X POST "$BASE/media/upload" -H "$AUTH" -F "file=@/tmp/test-upload.txt;type=text/plain" -F "description=test upload")
UL_S=$(echo "$UL" | tail -1); UL_B=$(echo "$UL" | sed '$d')
MEDIA_ID=$(echo "$UL_B" | python3 -c "import sys,json; print(json.load(sys.stdin).get('data',{}).get('id',''))" 2>/dev/null)
TOTAL=$((TOTAL+1)); [ "$UL_S" = "201" ] && { PASS=$((PASS+1)); echo -e "${GREEN}[PASS]${NC} POST /media/upload (201)"; } || { FAIL=$((FAIL+1)); echo -e "${RED}[FAIL]${NC} POST /media/upload ($UL_S)"; echo "  $(echo "$UL_B" | head -c 200)"; }

test_endpoint GET "/media/search" "" "200" "Search media" "$AUTH"
[ -n "$MEDIA_ID" ] && {
  test_endpoint GET "/media/$MEDIA_ID" "" "200" "Get media" "$AUTH"
  test_endpoint GET "/media/user/$ADMIN_ID" "" "200" "User media" "$AUTH"
  test_endpoint DELETE "/media/$MEDIA_ID" "" "200" "Delete media" "$AUTH"
  test_endpoint POST "/media/$MEDIA_ID/restore" "" "201" "Restore media" "$AUTH"
}
test_endpoint POST "/media/presign" '{"fileName":"doc.pdf","mimeType":"application/pdf","sizeBytes":1024}' "201" "Presigned URL" "$AUTH"

# === ADMIN (14) ===
echo -e "\n${YELLOW}--- Admin Module ---${NC}"
test_endpoint GET "/admin/dashboard/metrics" "" "200" "Dashboard metrics" "$AUTH"
test_endpoint GET "/admin/dashboard/sla-summary" "" "200" "SLA summary" "$AUTH"
test_endpoint GET "/admin/dashboard/escalations" "" "200" "Escalations" "$AUTH"
test_endpoint GET "/admin/dashboard/ai-metrics" "" "200" "AI metrics" "$AUTH"

HIGH_P=$(curl -s "$BASE/ticket-priorities" -H "$AUTH" | python3 -c "import sys,json; p=json.load(sys.stdin).get('data',[]); print(next((x['id'] for x in p if x['name']=='HIGH'),''))" 2>/dev/null)
[ -n "$TICKET2_ID" ] && {
  test_endpoint PUT "/admin/tickets/$TICKET2_ID/priority" "{\"priorityId\":\"$HIGH_P\",\"reason\":\"Escalating\"}" "200" "Override priority" "$AUTH"
  test_endpoint PUT "/admin/tickets/$TICKET2_ID/reassign" "{\"assigneeId\":\"$AGENT_ID\",\"targetAgencyId\":\"$FIRST_AGENCY_ID\",\"reason\":\"Reassign to correct agent\"}" "200" "Reassign ticket" "$AUTH"
  # SLA override requires SLA tracking on ticket; 400 is valid here since no policy was set when ticket was created
  test_endpoint PUT "/admin/tickets/$TICKET2_ID/override" "{\"justification\":\"Override SLA due to special circumstances for this ticket\"}" "400" "Override SLA (no tracking)" "$AUTH"
}

test_endpoint GET "/admin/tickets/search?query=payment" "" "200" "Ticket search" "$AUTH"
test_endpoint GET "/admin/roles" "" "200" "List roles" "$AUTH"
test_endpoint GET "/admin/permissions" "" "200" "List permissions" "$AUTH"
test_endpoint POST "/admin/roles" "{\"name\":\"ROLE_${TS}\",\"description\":\"Custom role\"}" "201" "Create role" "$AUTH"

CR_ID=$(curl -s "$BASE/admin/roles" -H "$AUTH" | python3 -c "import sys,json; r=json.load(sys.stdin).get('data',[]); print(next((x['id'] for x in r if x['name']=='ROLE_${TS}'),''))" 2>/dev/null)
P_ID=$(curl -s "$BASE/admin/permissions" -H "$AUTH" | python3 -c "import sys,json; p=json.load(sys.stdin).get('data',[]); print(p[0]['id'] if p else '')" 2>/dev/null)
[ -n "$CR_ID" ] && [ -n "$P_ID" ] && test_endpoint PUT "/admin/roles/$CR_ID/permissions" "{\"permissionIds\":[\"$P_ID\"]}" "200" "Set permissions" "$AUTH"

test_endpoint PUT "/admin/policies/sla" "{\"agencyId\":\"$FIRST_AGENCY_ID\",\"policyName\":\"Default SLA Policy\",\"isActive\":true,\"appliesBusinessHours\":false}" "200" "Config SLA" "$AUTH"
test_endpoint PUT "/admin/policies/escalation" "{\"agencyId\":\"$FIRST_AGENCY_ID\",\"priorityLevel\":\"HIGH\",\"maxResponseTimeMinutes\":60,\"maxResolutionTimeMinutes\":480,\"autoEscalationEnabled\":true}" "200" "Config escalation" "$AUTH"

# === ML MODULE (9) ===
echo -e "\n${YELLOW}--- ML Module ---${NC}"
test_endpoint GET "/ml/metrics" "" "200" "ML metrics" "$AUTH"
test_endpoint GET "/ml/models" "" "200" "ML models" "$AUTH"
test_endpoint GET "/ml/clusters" "" "200" "ML clusters" "$AUTH"
test_endpoint POST "/ml/predict/sentiment" '{"text":"This is urgent and I am very frustrated with the service"}' "200" "Sentiment analysis" "$AUTH"
[ -n "$TICKET2_ID" ] && test_endpoint POST "/ml/predict/classify" "{\"ticketId\":\"$TICKET2_ID\",\"text\":\"Payment failed and I need urgent help\"}" "200" "ML classify" "$AUTH"
[ -n "$TICKET2_ID" ] && test_endpoint POST "/ml/predict/routing" "{\"ticketId\":\"$TICKET2_ID\"}" "200" "Routing recommendation" "$AUTH"
[ -n "$TICKET2_ID" ] && test_endpoint GET "/ml/predict/sla-breach/$TICKET2_ID" "" "200" "SLA breach prediction" "$AUTH"
[ -n "$TICKET2_ID" ] && test_endpoint GET "/ml/predict/kb-suggest/$TICKET2_ID" "" "200" "KB suggestions" "$AUTH"
[ -n "$FIRST_AGENCY_ID" ] && test_endpoint GET "/ml/forecast/$FIRST_AGENCY_ID" "" "200" "Capacity forecast" "$AUTH"

# === AUTHORIZATION (4) ===
echo -e "\n${YELLOW}--- Authorization Tests ---${NC}"
test_endpoint GET "/admin/dashboard/metrics" "" "403" "Citizen blocked admin" "$CITIZEN_AUTH"
test_endpoint GET "/users" "" "403" "Citizen blocked users" "$CITIZEN_AUTH"
test_endpoint POST "/agencies" '{"agencyCode":"HACK"}' "403" "Citizen blocked agencies" "$CITIZEN_AUTH"
test_endpoint POST "/auth/logout" '{}' "200" "Logout" "$AUTH"

# === RESULTS ===
echo -e "\n============================================"
echo "  TEST RESULTS"
echo "============================================"
echo -e "  Total:  $TOTAL"
echo -e "  ${GREEN}Passed: $PASS${NC}"
echo -e "  ${RED}Failed: $FAIL${NC}"
[ $TOTAL -gt 0 ] && echo -e "  Pass Rate: $(( PASS * 100 / TOTAL ))%"
echo "============================================"
rm -f /tmp/test-upload.txt
