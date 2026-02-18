#!/usr/bin/env python3
"""
Eenera V1 Backend API Testing Suite
Tests all main API endpoints for the governance engine
"""

import requests
import sys
import json
from datetime import datetime
from pathlib import Path

class EeneraAPITester:
    def __init__(self, base_url="https://governance-engine-2.preview.emergentagent.com"):
        self.base_url = base_url
        self.token = None
        self.tests_run = 0
        self.tests_passed = 0
        self.failed_tests = []
        self.user_id = None
        self.created_resources = {
            'org_id': None,
            'framework_id': None,
            'version_id': None,
            'assessment_id': None,
            'document_id': None,
            'gap_ids': [],
            'task_ids': []
        }

    def run_test(self, name, method, endpoint, expected_status, data=None, files=None, needs_auth=True):
        """Run a single API test"""
        url = f"{self.base_url}/api/{endpoint}"
        headers = {}
        
        if files:
            # For file uploads, don't set Content-Type
            pass
        else:
            headers['Content-Type'] = 'application/json'
        
        # Add token as query parameter if needed
        if self.token and needs_auth:
            if '?' in url:
                url += f'&authorization=Bearer {self.token}'
            else:
                url += f'?authorization=Bearer {self.token}'

        self.tests_run += 1
        print(f"\n🔍 Test {self.tests_run}: {name}")
        print(f"   {method} {endpoint}")
        
        try:
            if method == 'GET':
                response = requests.get(url, headers=headers, timeout=30)
            elif method == 'POST':
                if files:
                    if self.token and needs_auth:
                        if data is None:
                            data = {}
                        data['authorization'] = f'Bearer {self.token}'
                    response = requests.post(url, files=files, data=data, headers=headers, timeout=30)
                else:
                    if self.token and needs_auth:
                        if data is None:
                            data = {}
                        data['authorization'] = f'Bearer {self.token}'
                    response = requests.post(url, json=data, headers=headers, timeout=30)
            elif method == 'PUT':
                if self.token and needs_auth:
                    if data is None:
                        data = {}
                    data['authorization'] = f'Bearer {self.token}'
                response = requests.put(url, json=data, headers=headers, timeout=30)
            elif method == 'DELETE':
                response = requests.delete(url, headers=headers, timeout=30)

            success = response.status_code == expected_status
            if success:
                self.tests_passed += 1
                print(f"   ✅ PASSED - Status: {response.status_code}")
                try:
                    return True, response.json() if response.content else {}
                except:
                    return True, {}
            else:
                print(f"   ❌ FAILED - Expected {expected_status}, got {response.status_code}")
                print(f"   Response: {response.text[:200]}")
                self.failed_tests.append({
                    'name': name,
                    'expected': expected_status,
                    'actual': response.status_code,
                    'response': response.text[:200]
                })
                return False, {}

        except requests.exceptions.Timeout:
            print(f"   ❌ FAILED - Request timeout")
            self.failed_tests.append({'name': name, 'error': 'Timeout'})
            return False, {}
        except Exception as e:
            print(f"   ❌ FAILED - Error: {str(e)}")
            self.failed_tests.append({'name': name, 'error': str(e)})
            return False, {}

    def test_auth_flow(self):
        """Test user registration and login"""
        print("\n" + "="*60)
        print("TESTING AUTHENTICATION FLOW")
        print("="*60)
        
        # Test registration
        timestamp = datetime.now().strftime('%H%M%S')
        test_user = {
            "email": f"test_admin_{timestamp}@eenera.test",
            "password": "SecurePass123!",
            "name": f"Test Admin {timestamp}",
            "role": "admin"
        }
        
        success, response = self.run_test(
            "User Registration",
            "POST",
            "auth/register",
            200,
            data=test_user,
            needs_auth=False
        )
        
        if success and 'token' in response:
            self.token = response['token']
            self.user_id = response['user']['id']
            print(f"   📝 Registered user: {test_user['email']}")
            print(f"   🔑 Got token: {self.token[:20]}...")
        else:
            print("   ⚠️  Registration failed, cannot continue tests")
            return False
            
        # Test login
        success, response = self.run_test(
            "User Login",
            "POST", 
            "auth/login",
            200,
            data={"email": test_user['email'], "password": test_user['password']},
            needs_auth=False
        )
        
        if success and 'token' in response:
            print(f"   ✅ Login successful")
        
        # Test get current user
        self.run_test(
            "Get Current User",
            "GET",
            "auth/me",
            200
        )
        
        return True

    def test_framework_management(self):
        """Test framework and seed operations"""
        print("\n" + "="*60)
        print("TESTING FRAMEWORK MANAGEMENT")
        print("="*60)
        
        # Test seed data
        success, response = self.run_test(
            "Seed ICO/GDPR Framework",
            "POST",
            "seed",
            200
        )
        
        if success:
            self.created_resources['framework_id'] = response.get('framework_id')
            self.created_resources['version_id'] = response.get('version_id')
            print(f"   📦 Seeded framework: {response.get('framework_id', 'Unknown')[:12]}")
        
        # Test list frameworks
        success, response = self.run_test(
            "List Frameworks",
            "GET",
            "frameworks",
            200,
            needs_auth=False
        )
        
        if success and response:
            print(f"   📋 Found {len(response)} frameworks")
        
        # Test list versions
        if self.created_resources['framework_id']:
            success, response = self.run_test(
                "List Framework Versions",
                "GET",
                f"frameworks/{self.created_resources['framework_id']}/versions",
                200,
                needs_auth=False
            )
            
        # Test list obligations
        if self.created_resources['version_id']:
            success, response = self.run_test(
                "List Obligations",
                "GET",
                f"frameworks/{self.created_resources['version_id']}/obligations",
                200,
                needs_auth=False
            )
            
            if success and response:
                print(f"   📖 Found {len(response)} obligations")
                
            # Test list controls
            success, response = self.run_test(
                "List Controls",
                "GET",
                f"frameworks/{self.created_resources['version_id']}/controls",
                200,
                needs_auth=False
            )
            
            if success and response:
                print(f"   🎛️  Found {len(response)} controls")

    def test_organisation_management(self):
        """Test organisation operations"""
        print("\n" + "="*60)
        print("TESTING ORGANISATION MANAGEMENT")
        print("="*60)
        
        # Create organisation
        org_data = {
            "name": f"Test Organisation {datetime.now().strftime('%H%M%S')}",
            "description": "Test organisation for API testing"
        }
        
        success, response = self.run_test(
            "Create Organisation",
            "POST",
            "organisations",
            200,
            data=org_data
        )
        
        if success:
            self.created_resources['org_id'] = response.get('id')
            print(f"   🏢 Created org: {response.get('name', 'Unknown')}")
        
        # List organisations
        self.run_test(
            "List Organisations",
            "GET",
            "organisations",
            200
        )
        
        # Get specific organisation
        if self.created_resources['org_id']:
            self.run_test(
                "Get Organisation",
                "GET",
                f"organisations/{self.created_resources['org_id']}",
                200
            )

    def test_document_management(self):
        """Test document upload and management"""
        print("\n" + "="*60)
        print("TESTING DOCUMENT MANAGEMENT")
        print("="*60)
        
        if not self.created_resources['org_id']:
            print("   ⚠️  No organisation created, skipping document tests")
            return
        
        # Test sample policy upload
        success, response = self.run_test(
            "Upload Sample Policy",
            "POST",
            f"documents/upload?org_id={self.created_resources['org_id']}&use_sample=true",
            200
        )
        
        if success:
            self.created_resources['document_id'] = response.get('document_id')
            print(f"   📄 Uploaded document: {response.get('filename', 'Unknown')}")
            print(f"   📦 Created {response.get('chunks', 0)} chunks")
        
        # List documents
        if self.created_resources['org_id']:
            success, response = self.run_test(
                "List Documents",
                "GET",
                f"documents/{self.created_resources['org_id']}",
                200
            )
            
        # Get document chunks
        if self.created_resources['document_id']:
            success, response = self.run_test(
                "Get Document Chunks",
                "GET",
                f"documents/{self.created_resources['document_id']}/chunks",
                200
            )

    def test_assessment_flow(self):
        """Test assessment creation and generation"""
        print("\n" + "="*60)
        print("TESTING ASSESSMENT FLOW")
        print("="*60)
        
        if not self.created_resources['org_id'] or not self.created_resources['version_id']:
            print("   ⚠️  Missing org or framework version, skipping assessment tests")
            return
        
        # Create assessment
        assessment_data = {
            "org_id": self.created_resources['org_id'],
            "framework_version_id": self.created_resources['version_id']
        }
        
        success, response = self.run_test(
            "Create Assessment",
            "POST",
            "assessments",
            200,
            data=assessment_data
        )
        
        if success:
            self.created_resources['assessment_id'] = response.get('id')
            print(f"   📊 Created assessment: {response.get('id', 'Unknown')[:12]}")
        
        # List assessments
        self.run_test(
            "List Assessments",
            "GET",
            f"assessments?org_id={self.created_resources['org_id']}",
            200
        )
        
        # Generate assessment
        if self.created_resources['assessment_id']:
            print("   🤖 Generating assessment (may take 10-30 seconds)...")
            success, response = self.run_test(
                "Generate Assessment",
                "POST",
                f"assessments/{self.created_resources['assessment_id']}/generate",
                200
            )
            
            if success:
                score = response.get('score', {})
                print(f"   📈 Assessment complete: {score.get('overall', 0)}% score")
                print(f"   🎯 Coverage: {score.get('coverage', 0)}%")
                print(f"   📋 Band: {score.get('band', 'Unknown')}")
                print(f"   🚨 Gaps identified: {response.get('message', '')}")
        
        # Get full assessment
        if self.created_resources['assessment_id']:
            success, response = self.run_test(
                "Get Assessment Details",
                "GET",
                f"assessments/{self.created_resources['assessment_id']}",
                200
            )
            
            if success:
                gaps = response.get('gaps', [])
                tasks = response.get('tasks', [])
                print(f"   📊 Assessment has {len(gaps)} gaps and {len(tasks)} tasks")
        
        # Get assessment score
        if self.created_resources['assessment_id']:
            self.run_test(
                "Get Assessment Score",
                "GET",
                f"assessments/{self.created_resources['assessment_id']}/score",
                200
            )

    def test_gap_and_task_management(self):
        """Test gaps and tasks operations"""
        print("\n" + "="*60)
        print("TESTING GAPS & TASKS MANAGEMENT")
        print("="*60)
        
        if not self.created_resources['assessment_id']:
            print("   ⚠️  No assessment created, skipping gap/task tests")
            return
        
        # List gaps
        success, response = self.run_test(
            "List Gaps",
            "GET",
            f"gaps/assessment/{self.created_resources['assessment_id']}",
            200
        )
        
        gaps = []
        if success and response:
            gaps = response
            print(f"   🚨 Found {len(gaps)} gaps")
        
        # Create task from first gap
        if gaps:
            gap = gaps[0]
            task_data = {
                "gap_id": gap['id'],
                "assessment_id": self.created_resources['assessment_id'],
                "description": f"Address gap: {gap.get('description', 'Unknown gap')}",
                "assigned_to": "Test DPO",
                "due_date": "2024-12-31"
            }
            
            success, response = self.run_test(
                "Create Task from Gap",
                "POST",
                "tasks",
                200,
                data=task_data
            )
            
            if success:
                task_id = response.get('id')
                self.created_resources['task_ids'].append(task_id)
                print(f"   📋 Created task: {task_id[:12] if task_id else 'Unknown'}")
        
        # List tasks
        success, response = self.run_test(
            "List Tasks",
            "GET",
            f"tasks/assessment/{self.created_resources['assessment_id']}",
            200
        )
        
        # Update task status
        if self.created_resources['task_ids']:
            task_id = self.created_resources['task_ids'][0]
            success, response = self.run_test(
                "Update Task Status",
                "PUT",
                f"tasks/{task_id}",
                200,
                data={"status": "completed"}
            )
        
        # Create approval
        if self.created_resources['task_ids']:
            task_id = self.created_resources['task_ids'][0]
            approval_data = {
                "task_id": task_id,
                "action": "approved",
                "comment": "Task completed successfully"
            }
            
            success, response = self.run_test(
                "Create Approval",
                "POST",
                "approvals",
                200,
                data=approval_data
            )
            
            if success:
                print(f"   ✅ Task approved by {response.get('approver_name', 'Unknown')}")

    def test_control_assessments(self):
        """Test control assessment operations"""
        print("\n" + "="*60)
        print("TESTING CONTROL ASSESSMENTS")
        print("="*60)
        
        if not self.created_resources['assessment_id']:
            print("   ⚠️  No assessment created, skipping control tests")
            return
        
        # List control assessments
        success, response = self.run_test(
            "List Control Assessments",
            "GET",
            f"control-assessments/assessment/{self.created_resources['assessment_id']}",
            200
        )
        
        controls = []
        if success and response:
            controls = response
            print(f"   🎛️  Found {len(controls)} control assessments")
        
        # Override a control assessment
        if controls:
            control = controls[0]
            override_data = {
                "status": "MET",
                "confidence": 0.95,
                "rationale": "Manual override for testing purposes"
            }
            
            success, response = self.run_test(
                "Override Control Assessment",
                "PUT",
                f"control-assessments/{control['id']}",
                200,
                data=override_data
            )
            
            if success:
                print(f"   🔧 Overrode control {control.get('control_ref', 'Unknown')} to MET")

    def test_reporting_and_export(self):
        """Test report generation and PDF export"""
        print("\n" + "="*60)
        print("TESTING REPORTING & EXPORT")
        print("="*60)
        
        if not self.created_resources['assessment_id']:
            print("   ⚠️  No assessment created, skipping report tests")
            return
        
        # Test report preview
        success, response = self.run_test(
            "Get Report Preview",
            "GET",
            f"reports/{self.created_resources['assessment_id']}/preview",
            200
        )
        
        if success:
            org_name = response.get('organisation', {}).get('name', 'Unknown')
            score = response.get('score', {})
            print(f"   📋 Report for: {org_name}")
            print(f"   📊 Score: {score.get('overall', 0)}% ({score.get('band', 'Unknown')})")
        
        # Test PDF generation (checking endpoint availability)
        print(f"   📄 PDF export endpoint: /api/reports/{self.created_resources['assessment_id']}/pdf")
        print(f"   ℹ️  PDF generation requires browser download, not tested via API")

    def test_audit_logs(self):
        """Test audit logging"""
        print("\n" + "="*60)
        print("TESTING AUDIT LOGS")
        print("="*60)
        
        # List all audit logs
        success, response = self.run_test(
            "List Audit Logs",
            "GET",
            "audit-logs?limit=20",
            200,
            needs_auth=False
        )
        
        if success and response:
            print(f"   📜 Found {len(response)} audit log entries")
            if response:
                latest = response[0]
                print(f"   🔍 Latest: {latest.get('action', 'Unknown')} by {latest.get('user_id', 'Unknown')[:12]}")

    def run_all_tests(self):
        """Run complete test suite"""
        print("🚀 Starting Eenera V1 Backend API Test Suite")
        print(f"🌐 Testing against: {self.base_url}")
        print(f"⏰ Started at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        
        try:
            # Run test suites
            if not self.test_auth_flow():
                print("\n❌ Authentication failed, stopping tests")
                return False
                
            self.test_framework_management()
            self.test_organisation_management()
            self.test_document_management()
            self.test_assessment_flow()
            self.test_gap_and_task_management()
            self.test_control_assessments()
            self.test_reporting_and_export()
            self.test_audit_logs()
            
            # Final summary
            print("\n" + "="*60)
            print("FINAL TEST RESULTS")
            print("="*60)
            print(f"📊 Tests Run: {self.tests_run}")
            print(f"✅ Passed: {self.tests_passed}")
            print(f"❌ Failed: {len(self.failed_tests)}")
            print(f"📈 Success Rate: {(self.tests_passed/self.tests_run)*100:.1f}%")
            
            if self.failed_tests:
                print(f"\n🚨 FAILED TESTS:")
                for i, fail in enumerate(self.failed_tests[:10], 1):
                    print(f"   {i}. {fail['name']}")
                    if 'expected' in fail:
                        print(f"      Expected {fail['expected']}, got {fail['actual']}")
                    if 'error' in fail:
                        print(f"      Error: {fail['error']}")
                if len(self.failed_tests) > 10:
                    print(f"   ... and {len(self.failed_tests) - 10} more")
            
            print(f"\n🏁 Completed at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
            
            return len(self.failed_tests) == 0
            
        except KeyboardInterrupt:
            print("\n⚠️  Tests interrupted by user")
            return False
        except Exception as e:
            print(f"\n💥 Unexpected error: {str(e)}")
            return False

def main():
    """Main test execution"""
    tester = EeneraAPITester()
    
    print("🧪 Eenera V1 Governance Engine - Backend API Tests")
    print("=" * 60)
    
    success = tester.run_all_tests()
    
    # Save detailed results
    results = {
        'timestamp': datetime.now().isoformat(),
        'base_url': tester.base_url,
        'total_tests': tester.tests_run,
        'passed_tests': tester.tests_passed,
        'failed_tests': tester.failed_tests,
        'success_rate': (tester.tests_passed/tester.tests_run)*100 if tester.tests_run > 0 else 0,
        'created_resources': tester.created_resources
    }
    
    # Write results to file
    results_file = Path('/app/test_reports') / f'backend_test_results_{datetime.now().strftime("%Y%m%d_%H%M%S")}.json'
    results_file.parent.mkdir(exist_ok=True)
    
    with open(results_file, 'w') as f:
        json.dump(results, f, indent=2)
    
    print(f"\n💾 Detailed results saved to: {results_file}")
    
    return 0 if success else 1

if __name__ == "__main__":
    sys.exit(main())